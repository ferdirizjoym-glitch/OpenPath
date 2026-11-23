const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);

const root = process.cwd();
const redisKeys = {
  places: 'openpath:v1:places',
  requests: 'openpath:v1:requests',
  admins: 'openpath:v1:admins'
};
let redisClient;

function storageConfigured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function redis() {
  if (!storageConfigured()) {
    const error = new Error('Connect Upstash Redis to this Vercel project before using OpenPath data.');
    error.statusCode = 503;
    throw error;
  }
  if (!redisClient) redisClient = require('@upstash/redis').Redis.fromEnv();
  return redisClient;
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function decode(value, fallback) {
  if (value === null || value === undefined) return fallback;
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function hashValues(hash) {
  return Object.values(hash || {}).map(value => decode(value, null)).filter(Boolean);
}

function localPlacesSeed() {
  try { return JSON.parse(fs.readFileSync(path.join(root, 'data', 'places.json'), 'utf8')); }
  catch { return []; }
}

async function records(name) {
  const client = redis();
  const key = redisKeys[name];
  const initializedKey = `${key}:initialized`;
  if (!await client.get(initializedKey)) {
    const current = await client.hgetall(key);
    const seed = name === 'places' ? localPlacesSeed() : [];
    if ((!current || !Object.keys(current).length) && seed.length) {
      await client.hset(key, Object.fromEntries(seed.map(item => [String(item.id), JSON.stringify(item)])));
    }
    await client.set(initializedKey, '1');
  }
  return hashValues(await client.hgetall(key));
}

async function saveRecord(name, id, value) {
  await redis().hset(redisKeys[name], { [String(id)]: JSON.stringify(value) });
}

async function removeRecord(name, id) {
  await redis().hdel(redisKeys[name], String(id));
}

async function nextId(name, current = []) {
  const client = redis();
  const counter = `openpath:v1:${name}:next-id`;
  const initial = name === 'places' ? Math.max(0, ...current.map(item => Number(item.id) || 0)) : 0;
  await client.set(counter, String(initial), { nx: true });
  return Number(await client.incr(counter));
}

function sessionId(req) {
  return (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith('openpath_session='))?.slice(17);
}

function remoteImageKey(imageUrl) {
  const match = String(imageUrl || '').match(/^\/api\/images\/(\d+)\/([a-zA-Z0-9_-]+)$/);
  return match ? `openpath:v1:image:${match[1]}:${match[2]}` : null;
}

async function session(req) {
  const sid = sessionId(req);
  if (!sid) return null;
  return decode(await redis().get(`openpath:v1:session:${sid}`), null);
}

async function requireAdmin(req, res) {
  if (await session(req)) return true;
  json(res, 401, { error: 'Admin sign-in required.' });
  return false;
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; }
  catch { return false; }
}

async function readBody(req) {
  if (req.body !== undefined) {
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8'));
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4_400_000) {
      const error = new Error('Request is too large. Images must be 3 MB or smaller.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function redirect(res, destination) {
  res.writeHead(302, { Location: destination, 'Cache-Control': 'no-store' });
  res.end();
}

function servePage(res, filename) {
  fs.readFile(path.join(root, filename), (error, content) => {
    if (error) return json(res, 500, { error: 'Could not load this page.' });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(content);
  });
}

function setSessionCookie(res, sid) {
  const secure = process.env.VERCEL ? '; Secure' : '';
  res.setHeader('Set-Cookie', `openpath_session=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`);
}

async function handle(req, res) {
  const url = new URL(req.url, 'https://openpath.invalid');
  const route = url.pathname;

  if (route === '/admin' && req.method === 'GET') {
    if (!storageConfigured()) return redirect(res, '/admin/login');
    return redirect(res, await session(req) ? '/admin/dashboard' : '/admin/login');
  }
  if (route === '/admin/login' && req.method === 'GET') {
    if (!storageConfigured()) return redirect(res, '/admin-login.html');
    return redirect(res, await session(req) ? '/admin/dashboard' : '/admin-login.html');
  }
  if (route === '/admin/dashboard' || route === '/admin.html') {
    if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
    if (!storageConfigured()) return redirect(res, '/admin/login');
    if (!await session(req)) return redirect(res, '/admin/login');
    return servePage(res, 'admin.html');
  }
  if (route === '/admin/protected' && req.method === 'GET') {
    if (!storageConfigured()) return servePage(res, 'admin-protected.html');
    const admins = await records('admins');
    if (admins.length && !await session(req)) return redirect(res, '/admin/login');
    return servePage(res, 'admin-protected.html');
  }
  if (route === '/admin-protected.html' && req.method === 'GET') return redirect(res, '/admin/protected');

  if (route === '/api/auth/status' && req.method === 'GET') {
    if (!storageConfigured()) return json(res, 200, { setupRequired: true, setupTokenRequired: Boolean(process.env.OPENPATH_SETUP_TOKEN), hosted: true, storageRequired: true, signedIn: false });
    const admins = await records('admins');
    return json(res, 200, {
      setupRequired: admins.length === 0,
      setupTokenRequired: Boolean(process.env.OPENPATH_SETUP_TOKEN),
      hosted: true,
      signedIn: Boolean(await session(req))
    });
  }

  if (route === '/api/auth/login' && req.method === 'POST') {
    if (!sameOrigin(req)) return json(res, 403, { error: 'Invalid origin.' });
    const body = await readBody(req);
    const username = String(body.username || '');
    const account = (await records('admins')).find(item => item.username.toLowerCase() === username.toLowerCase());
    if (!account) return json(res, 401, { error: 'Incorrect username or password.' });
    const hash = await scrypt(String(body.password || ''), Buffer.from(account.salt, 'hex'), 64);
    if (!crypto.timingSafeEqual(hash, Buffer.from(account.hash, 'hex'))) return json(res, 401, { error: 'Incorrect username or password.' });
    const sid = crypto.randomBytes(32).toString('hex');
    await redis().set(`openpath:v1:session:${sid}`, JSON.stringify({ username: account.username }), { ex: 28800 });
    setSessionCookie(res, sid);
    return json(res, 200, { ok: true });
  }

  if (route === '/api/auth/logout' && req.method === 'POST') {
    const sid = sessionId(req);
    if (sid) await redis().del(`openpath:v1:session:${sid}`);
    res.setHeader('Set-Cookie', 'openpath_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0; Secure');
    return json(res, 200, { ok: true });
  }

  if (route === '/api/admins' && req.method === 'GET') {
    if (!await requireAdmin(req, res)) return;
    return json(res, 200, (await records('admins')).map(admin => ({ username: admin.username })));
  }

  if (route === '/api/admins' && req.method === 'POST') {
    if (!sameOrigin(req)) return json(res, 403, { error: 'Invalid origin.' });
    const body = await readBody(req);
    const admins = await records('admins');
    if (admins.length && !await session(req)) return json(res, 401, { error: 'Admin sign-in required.' });
    if (!admins.length) {
      if (!process.env.OPENPATH_SETUP_TOKEN) return json(res, 503, { error: 'Set OPENPATH_SETUP_TOKEN in Vercel before creating the first admin.' });
      if (String(body.setupToken || '') !== process.env.OPENPATH_SETUP_TOKEN) return json(res, 403, { error: 'The deployment setup token is incorrect.' });
    }
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username) || password.length < 10) return json(res, 400, { error: 'Use a 3–32 character username and a password of at least 10 characters.' });
    if (admins.some(admin => admin.username.toLowerCase() === username.toLowerCase())) return json(res, 409, { error: 'That username already exists.' });
    const salt = crypto.randomBytes(16);
    const hash = await scrypt(password, salt, 64);
    const account = { username, salt: salt.toString('hex'), hash: hash.toString('hex'), createdAt: new Date().toISOString() };
    await saveRecord('admins', username.toLowerCase(), account);
    return json(res, 201, { ok: true, username });
  }

  const adminDelete = route.match(/^\/api\/admins\/([^/]+)$/);
  if (adminDelete && req.method === 'DELETE') {
    if (!await requireAdmin(req, res)) return;
    if (!sameOrigin(req)) return json(res, 403, { error: 'Invalid origin.' });
    const username = decodeURIComponent(adminDelete[1]);
    const admins = await records('admins');
    const nextAdmins = admins.filter(admin => admin.username !== username);
    if (nextAdmins.length === admins.length) return json(res, 404, { error: 'Admin not found.' });
    if (!nextAdmins.length) return json(res, 400, { error: 'At least one admin must remain.' });
    await removeRecord('admins', username.toLowerCase());
    return json(res, 200, { ok: true });
  }

  if (route === '/api/places' && req.method === 'GET') {
    if (!storageConfigured()) return json(res, 200, localPlacesSeed());
    return json(res, 200, await records('places'));
  }

  if (route === '/api/places' && req.method === 'POST') {
    if (!await requireAdmin(req, res)) return;
    if (!sameOrigin(req)) return json(res, 403, { error: 'Invalid origin.' });
    const incoming = await readBody(req);
    const places = await records('places');
    if (!incoming.name || !Number.isFinite(Number(incoming.lat)) || !Number.isFinite(Number(incoming.lng))) return json(res, 400, { error: 'Name and valid map coordinates are required.' });
    const id = Number(incoming.id) || await nextId('places', places);
    const previous = places.find(place => Number(place.id) === id);
    const place = { ...incoming, id };
    if (incoming.imageData) {
      const match = String(incoming.imageData).match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
      if (!match) return json(res, 400, { error: 'Upload a PNG, JPEG, or WebP image.' });
      const bytes = Buffer.from(match[2], 'base64');
      if (bytes.length > 3 * 1024 * 1024) return json(res, 413, { error: 'Image must be 3 MB or smaller on Vercel.' });
      const imageVersion = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      await redis().set(`openpath:v1:image:${id}:${imageVersion}`, JSON.stringify({ type: `image/${match[1]}`, data: match[2] }));
      place.image = `/api/images/${id}/${imageVersion}`;
      delete place.imageData;
    }
    await saveRecord('places', id, place);
    const oldImageKey = remoteImageKey(previous?.image);
    if (oldImageKey && oldImageKey !== remoteImageKey(place.image)) await redis().del(oldImageKey);
    return json(res, 200, place);
  }

  const imageMatch = route.match(/^\/api\/images\/(\d+)\/([a-zA-Z0-9_-]+)$/);
  if (imageMatch && req.method === 'GET') {
    const image = decode(await redis().get(`openpath:v1:image:${imageMatch[1]}:${imageMatch[2]}`), null);
    if (!image) return json(res, 404, { error: 'Image not found.' });
    const bytes = Buffer.from(image.data, 'base64');
    res.writeHead(200, { 'Content-Type': image.type, 'Content-Length': bytes.length, 'Cache-Control': 'public, max-age=300' });
    return res.end(bytes);
  }

  const placeDelete = route.match(/^\/api\/places\/(\d+)$/);
  if (placeDelete && req.method === 'DELETE') {
    if (!await requireAdmin(req, res)) return;
    if (!sameOrigin(req)) return json(res, 403, { error: 'Invalid origin.' });
    const id = Number(placeDelete[1]);
    const place = (await records('places')).find(item => Number(item.id) === id);
    await removeRecord('places', id);
    const imageKey = remoteImageKey(place?.image);
    if (imageKey) await redis().del(imageKey);
    return json(res, 200, { ok: true });
  }

  if (route === '/api/requests' && req.method === 'GET') {
    if (!await requireAdmin(req, res)) return;
    return json(res, 200, await records('requests'));
  }

  if (route === '/api/requests' && req.method === 'POST') {
    const incoming = await readBody(req);
    if (!incoming.name || !Number.isFinite(Number(incoming.lat)) || !Number.isFinite(Number(incoming.lng))) return json(res, 400, { error: 'Place name and a map pin are required.' });
    const request = { ...incoming, id: await nextId('requests'), status: 'pending', submittedAt: new Date().toISOString() };
    await saveRecord('requests', request.id, request);
    return json(res, 201, { ok: true, id: request.id });
  }

  const reviewMatch = route.match(/^\/api\/requests\/(\d+)$/);
  if (reviewMatch && req.method === 'PATCH') {
    if (!await requireAdmin(req, res)) return;
    if (!sameOrigin(req)) return json(res, 403, { error: 'Invalid origin.' });
    const incoming = await readBody(req);
    const request = (await records('requests')).find(item => Number(item.id) === Number(reviewMatch[1]));
    if (!request) return json(res, 404, { error: 'Request not found.' });
    if (incoming.status === 'rejected') {
      request.status = 'rejected';
      await saveRecord('requests', request.id, request);
      return json(res, 200, request);
    }
    if (incoming.status === 'approved') {
      const places = await records('places');
      const place = { ...request, id: await nextId('places', places), verified: 'Admin reviewed', icon: '⌂' };
      delete place.status;
      delete place.submittedAt;
      await saveRecord('places', place.id, place);
      request.status = 'approved';
      request.placeId = place.id;
      await saveRecord('requests', request.id, request);
      return json(res, 200, request);
    }
    return json(res, 400, { error: 'Choose approve or reject.' });
  }

  return json(res, 404, { error: 'Not found.' });
}

module.exports = async function vercelHandler(req, res) {
  try { await handle(req, res); }
  catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error(`OpenPath API error: ${error.message}`);
    if (!res.headersSent) json(res, status, { error: status === 503 ? error.message : status === 413 ? error.message : 'The request could not be completed.' });
  }
};
