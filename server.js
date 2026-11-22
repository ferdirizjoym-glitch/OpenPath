const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);

const port = Number(process.env.PORT) || 3000;
const dataFile = path.join(__dirname, 'data', 'places.json');
const requestsFile = path.join(__dirname, 'data', 'requests.json');
const adminsFile = path.join(__dirname, 'data', 'admins.json');
const sessions = new Map();
const seed = [
  { id: 1, name: 'Sample destination 1', category: 'Public service', area: 'Olongapo', lat: 14.8386, lng: 120.2842, icon: '⌂', features: { Ramp: 'Unverified', 'Step-free entrance': 'Unverified', 'Accessible restroom': 'Unverified', Elevator: 'Unverified' }, verified: 'Illustrative data' },
  { id: 2, name: 'Sample destination 2', category: 'Shopping', area: 'Olongapo', lat: 14.8338, lng: 120.2884, icon: '▧', features: { Ramp: 'Unverified', 'Step-free entrance': 'Unverified', 'Accessible restroom': 'Unverified', Elevator: 'Unverified' }, verified: 'Illustrative data' },
  { id: 3, name: 'Sample destination 3', category: 'Health', area: 'Olongapo', lat: 14.8452, lng: 120.2761, icon: '✚', features: { Ramp: 'Unverified', 'Step-free entrance': 'Unverified', 'Accessible restroom': 'Unverified', Elevator: 'Unverified' }, verified: 'Illustrative data' }
];
const files = {
  '/': ['index.html', 'text/html; charset=utf-8'], '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/map': ['map.html', 'text/html; charset=utf-8'], '/map.html': ['map.html', 'text/html; charset=utf-8'], '/map-page.js': ['map-page.js', 'text/javascript; charset=utf-8'], '/map-page.css': ['map-page.css', 'text/css; charset=utf-8'], '/map.js': ['map.js', 'text/javascript; charset=utf-8'], '/home.js': ['home.js', 'text/javascript; charset=utf-8'], '/home.css': ['home.css', 'text/css; charset=utf-8'],
  '/admin/dashboard': ['admin.html', 'text/html; charset=utf-8'], '/admin.html': ['admin.html', 'text/html; charset=utf-8'],
  '/admin-login.html': ['admin-login.html', 'text/html; charset=utf-8'], '/admin-protected.html': ['admin-protected.html', 'text/html; charset=utf-8'],
  '/suggest': ['suggest.html', 'text/html; charset=utf-8'], '/suggest.html': ['suggest.html', 'text/html; charset=utf-8'],
  '/guide': ['guide.html', 'text/html; charset=utf-8'], '/guide.css': ['guide.css', 'text/css; charset=utf-8'], '/guide.js': ['guide.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/admin.js': ['admin.js', 'text/javascript; charset=utf-8'], '/suggest.js': ['suggest.js', 'text/javascript; charset=utf-8']
};
function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
function readPlaces() {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, JSON.stringify(seed, null, 2));
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}
function savePlaces(places) { fs.writeFileSync(dataFile, JSON.stringify(places, null, 2)); }
function readRequests() { fs.mkdirSync(path.dirname(requestsFile), { recursive: true }); if (!fs.existsSync(requestsFile)) fs.writeFileSync(requestsFile, '[]'); return JSON.parse(fs.readFileSync(requestsFile, 'utf8')); }
function saveRequests(requests) { fs.writeFileSync(requestsFile, JSON.stringify(requests, null, 2)); }
function readAdmins() { fs.mkdirSync(path.dirname(adminsFile), { recursive: true }); if (!fs.existsSync(adminsFile)) fs.writeFileSync(adminsFile,'[]'); return JSON.parse(fs.readFileSync(adminsFile,'utf8')); }
function readSession(req) { const sid=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('openpath_session='))?.slice(17); const session=sid&&sessions.get(sid); if(session&&session.expires>Date.now())return session; if(sid)sessions.delete(sid); return null; }
function requireAdmin(req,res){if(readSession(req))return true;json(res,401,{error:'Admin sign-in required.'});return false}
function localOrigin(req){const origin=req.headers.origin;if(!origin)return true;try{return new URL(origin).host===req.headers.host}catch{return false}}
function readJsonBody(req,res,done){readBody(req,res,done)}
function readBody(req, res, done) { let raw=''; req.on('data', chunk=>{raw+=chunk;if(raw.length>1e6)req.destroy()}); req.on('end',()=>{try{done(JSON.parse(raw))}catch{json(res,400,{error:'Invalid request data.'})}}); }
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const assetMatch=url.pathname.match(/^\/assets\/([a-z0-9-]+\.(?:png|jpe?g|webp))$/i);
  if(assetMatch&&req.method==='GET'){const asset=path.join(__dirname,'assets',assetMatch[1]);const ext=path.extname(asset).toLowerCase();const type=ext==='.png'?'image/png':ext==='.webp'?'image/webp':'image/jpeg';return fs.readFile(asset,(error,content)=>{if(error){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'Content-Type':type,'Cache-Control':'public, max-age=86400'});res.end(content)})}
  if(url.pathname==='/admin') { const session=readSession(req);res.writeHead(302,{Location:session?'/admin/dashboard':'/admin/login'});return res.end(); }
  if(url.pathname==='/admin/protected') { const admins=readAdmins();if(admins.length&&!readSession(req)){res.writeHead(302,{Location:'/admin/login'});return res.end()}return fs.readFile(path.join(__dirname,'admin-protected.html'),(error,content)=>{if(error){res.writeHead(500);return res.end('Could not load admin account page.')}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(content)}); }
  if(url.pathname==='/admin-protected.html'){res.writeHead(302,{Location:'/admin/protected'});return res.end()}
  if(url.pathname==='/admin/login') { const session=readSession(req);res.writeHead(302,{Location:session?'/admin/dashboard':'/admin-login.html'});return res.end(); }
  if(url.pathname==='/api/auth/status'&&req.method==='GET')return json(res,200,{setupRequired:readAdmins().length===0,signedIn:!!readSession(req)});
  if(url.pathname==='/api/auth/login'&&req.method==='POST')return readJsonBody(req,res,async body=>{if(!localOrigin(req))return json(res,403,{error:'Invalid origin.'});const user=String(body.username||'');const account=readAdmins().find(a=>a.username.toLowerCase()===user.toLowerCase());if(!account)return json(res,401,{error:'Incorrect username or password.'});const hash=await scrypt(String(body.password||''),Buffer.from(account.salt,'hex'),64);if(!crypto.timingSafeEqual(hash,Buffer.from(account.hash,'hex')))return json(res,401,{error:'Incorrect username or password.'});const sid=crypto.randomBytes(32).toString('hex');sessions.set(sid,{username:account.username,expires:Date.now()+8*60*60*1000});res.writeHead(200,{'Set-Cookie':`openpath_session=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`,'Content-Type':'application/json'});res.end(JSON.stringify({ok:true}));});
  if(url.pathname==='/api/auth/logout'&&req.method==='POST'){const session=readSession(req);if(session){const sid=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('openpath_session='))?.slice(17);sessions.delete(sid)}res.writeHead(200,{'Set-Cookie':'openpath_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0','Content-Type':'application/json'});return res.end('{"ok":true}')}
  if(url.pathname==='/api/admins'&&req.method==='GET'){if(!requireAdmin(req,res))return;return json(res,200,readAdmins().map(a=>({username:a.username})));}
  if(url.pathname==='/api/admins'&&req.method==='POST')return readJsonBody(req,res,async body=>{if(!localOrigin(req))return json(res,403,{error:'Invalid origin.'});const admins=readAdmins(),session=readSession(req);if(admins.length&& !session)return json(res,401,{error:'Admin sign-in required.'});const username=String(body.username||'').trim(),password=String(body.password||'');if(!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)||password.length<10)return json(res,400,{error:'Use a 3–32 character username and a password of at least 10 characters.'});if(admins.some(a=>a.username.toLowerCase()===username.toLowerCase()))return json(res,409,{error:'That username already exists.'});const salt=crypto.randomBytes(16),hash=await scrypt(password,salt,64);admins.push({username,salt:salt.toString('hex'),hash:hash.toString('hex'),createdAt:new Date().toISOString()});fs.writeFileSync(adminsFile,JSON.stringify(admins,null,2));return json(res,201,{ok:true,username});});
  if(url.pathname.startsWith('/api/admins')&&req.method==='DELETE'){if(!requireAdmin(req,res))return;if(!localOrigin(req))return json(res,403,{error:'Invalid origin.'});const username=decodeURIComponent(url.pathname.split('/').pop()),admins=readAdmins().filter(a=>a.username!==username);if(admins.length===readAdmins().length)return json(res,404,{error:'Admin not found.'});if(!admins.length)return json(res,400,{error:'At least one admin must remain.'});fs.writeFileSync(adminsFile,JSON.stringify(admins,null,2));return json(res,200,{ok:true});}
  if(['/admin/dashboard','/admin.html'].includes(url.pathname)&&!readSession(req)){res.writeHead(302,{Location:'/admin/login'});return res.end()}
  if(['/api/places','/api/requests'].includes(url.pathname)&&req.method!=='GET'&&req.method!=='POST'){}
  if (url.pathname === '/api/places') {
    if (req.method === 'GET') return json(res, 200, readPlaces());
    if (req.method === 'POST') {
      if(!requireAdmin(req,res)||!localOrigin(req))return;
      let raw = ''; req.on('data', chunk => { raw += chunk; if (raw.length > 8e6) req.destroy(); });
      req.on('end', () => {
        try {
          const incoming = JSON.parse(raw); const places = readPlaces();
          if (!incoming.name || !Number.isFinite(Number(incoming.lat)) || !Number.isFinite(Number(incoming.lng))) return json(res, 400, { error: 'Name and valid map coordinates are required.' });
          const place = { ...incoming, id: incoming.id || Math.max(0, ...places.map(p => Number(p.id) || 0)) + 1 };
          if(incoming.imageData){const match=String(incoming.imageData).match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);if(!match)return json(res,400,{error:'Upload a PNG, JPEG, or WebP image.'});const bytes=Buffer.from(match[2],'base64');if(bytes.length>5*1024*1024)return json(res,413,{error:'Image must be 5 MB or smaller.'});const extension=match[1]==='jpeg'?'jpg':match[1];const imageName=`place-${place.id}-${Date.now()}.${extension}`;fs.mkdirSync(path.join(__dirname,'assets'),{recursive:true});fs.writeFileSync(path.join(__dirname,'assets',imageName),bytes);place.image=`/assets/${imageName}`;delete place.imageData;}
          const index = places.findIndex(p => p.id === place.id);
          if (index < 0) places.push(place); else places[index] = place;
          savePlaces(places); json(res, 200, place);
        } catch { json(res, 400, { error: 'Invalid place data.' }); }
      }); return;
    }
  }
  if (url.pathname === '/api/requests') {
    if (req.method === 'GET') {if(!requireAdmin(req,res))return;return json(res, 200, readRequests());}
    if (req.method === 'POST') return readBody(req,res,incoming=>{
      if (!incoming.name || !Number.isFinite(Number(incoming.lat)) || !Number.isFinite(Number(incoming.lng))) return json(res,400,{error:'Place name and a map pin are required.'});
      const requests=readRequests(); const request={...incoming,id:Date.now(),status:'pending',submittedAt:new Date().toISOString()}; requests.push(request); saveRequests(requests); json(res,201,{ok:true,id:request.id});
    });
  }
  const reviewMatch=url.pathname.match(/^\/api\/requests\/(\d+)$/);
  if (reviewMatch && req.method === 'PATCH') {if(!requireAdmin(req,res)||!localOrigin(req))return;return readBody(req,res,incoming=>{
    const requests=readRequests(),request=requests.find(item=>Number(item.id)===Number(reviewMatch[1])); if(!request)return json(res,404,{error:'Request not found.'});
    if(incoming.status==='rejected'){request.status='rejected';saveRequests(requests);return json(res,200,request)}
    if(incoming.status==='approved'){
      const places=readPlaces(); const place={...request,id:Math.max(0,...places.map(item=>Number(item.id)||0))+1,verified:'Admin reviewed',icon:'⌂'}; delete place.status; delete place.submittedAt; places.push(place); savePlaces(places); request.status='approved';request.placeId=place.id;saveRequests(requests);return json(res,200,request)
    }
    json(res,400,{error:'Choose approve or reject.'});
  });}
  const deleteMatch = url.pathname.match(/^\/api\/places\/(\d+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    if(!requireAdmin(req,res)||!localOrigin(req))return;
    const places = readPlaces().filter(place => Number(place.id) !== Number(deleteMatch[1])); savePlaces(places); return json(res, 200, { ok: true });
  }
  if (req.method !== 'GET' || !files[url.pathname]) { res.writeHead(404); return res.end('Not found'); }
  const [file, type] = files[url.pathname];
  fs.readFile(path.join(__dirname, file), (error, content) => {
    if (error) { res.writeHead(500); return res.end('Could not load page.'); }
    res.writeHead(200, { 'Content-Type': type }); res.end(content);
  });
});
server.listen(port, () => console.log(`Open Path running at http://localhost:${port} (admin: /admin)`));
