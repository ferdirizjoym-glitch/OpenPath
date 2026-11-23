const handler = require('./_runtime');

module.exports = (req, res) => {
  const route = new URL(req.url, 'https://openpath.invalid').searchParams.get('path');
  if (!route || !/^(admin(?:\/login|\/dashboard|\/protected)?|admin\.html|admin-protected\.html)$/.test(route)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Not found');
  }
  req.url = `/${route}`;
  return handler(req, res);
};
