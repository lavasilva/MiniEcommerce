require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const LOG_PATH = path.join(__dirname, 'logs', 'heartbeat.log');

const SERVICES = {
  users:    { url: process.env.USERS_URL    || 'http://localhost:5001', alive: true, failures: 0 },
  products: { url: process.env.PRODUCTS_URL || 'http://localhost:5002', alive: true, failures: 0 },
  orders:   { url: process.env.ORDERS_URL   || 'http://localhost:5003', alive: true, failures: 0 },
};

const ensureLog = () => {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const writeLog = (msg) => {
  ensureLog();
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(LOG_PATH, line);
  console.log(line.trim());
};

const checkHealth = (serviceUrl) => {
  return new Promise((resolve) => {
    const urlObj = new URL(serviceUrl);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: '/health',
      method: 'GET',
      timeout: 3000,
    };
    const req = http.request(options, (res) => resolve(res.statusCode === 200));
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
};

const runHeartbeat = async () => {
  for (const [name, service] of Object.entries(SERVICES)) {
    const ok = await checkHealth(service.url);
    if (ok) {
      if (!service.alive) writeLog(`RECOVERY service=${name} url=${service.url}`);
      service.alive = true;
      service.failures = 0;
    } else {
      service.failures += 1;
      if (service.failures >= 2 && service.alive) {
        service.alive = false;
        writeLog(`FAILURE service=${name} url=${service.url} attempts=${service.failures}`);
      }
    }
  }
};

setInterval(runHeartbeat, 5000);
runHeartbeat();

const proxyRequest = (serviceName, req, res) => {
  const service = SERVICES[serviceName];
  if (!service.alive) {
    return res.status(503).json({ error: `serviço ${serviceName} indisponível` });
  }
  const urlObj = new URL(service.url);
  const body = JSON.stringify(req.body);
  const hasBody = req.method !== 'GET' && req.method !== 'DELETE' && Object.keys(req.body).length > 0;
  const options = {
    hostname: urlObj.hostname,
    port: urlObj.port,
    path: req.originalUrl,
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      ...(req.headers['authorization'] ? { authorization: req.headers['authorization'] } : {}),
      ...(hasBody ? { 'Content-Length': Buffer.byteLength(body) } : {}),
    },
  };
  const proxyReq = http.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode);
    let data = '';
    proxyRes.on('data', chunk => data += chunk);
    proxyRes.on('end', () => {
      try { res.json(JSON.parse(data)); } catch { res.send(data); }
    });
  });
  proxyReq.on('error', () => res.status(502).json({ error: `erro ao conectar com ${serviceName}` }));
  if (hasBody) proxyReq.write(body);
  proxyReq.end();
};

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'gateway' }));

app.get('/status', (req, res) => {
  const status = {};
  for (const [name, s] of Object.entries(SERVICES)) {
    status[name] = { url: s.url, alive: s.alive, failures: s.failures };
  }
  res.json({ services: status });
});

app.use('/users',    (req, res) => proxyRequest('users', req, res));
app.use('/products', (req, res) => proxyRequest('products', req, res));
app.use('/orders',   (req, res) => proxyRequest('orders', req, res));

app.listen(PORT, () => console.log(`[gateway] running on port ${PORT}`));
