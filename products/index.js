require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const http = require('http');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5002;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const IS_REPLICA = process.env.REPLICA === 'true';
const REPLICA_URL = process.env.REPLICA_URL || 'http://localhost:5012';
const DB_PATH = path.join(__dirname, IS_REPLICA ? 'data/products-replica.json' : 'data/products.json');

const ensureDB = () => {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify([]));
};

const readProducts = () => {
  ensureDB();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
};

const writeProducts = (products) => {
  ensureDB();
  fs.writeFileSync(DB_PATH, JSON.stringify(products, null, 2));
};

const propagateToReplica = (method, endpoint, body) => {
  return new Promise((resolve) => {
    const replicaHost = REPLICA_URL.replace('http://', '').split(':')[0];
    const replicaPort = parseInt(REPLICA_URL.split(':')[2]) || 5012;
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: replicaHost,
      port: replicaPort,
      path: endpoint,
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-internal': 'true',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = http.request(options, (res) => {
      resolve({ ok: res.statusCode < 300 });
    });
    req.on('error', () => resolve({ ok: false }));
    if (data) req.write(data);
    req.end();
  });
};

const verifyToken = (req, res, next) => {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'token ausente' });
  }
  try {
    req.user = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'token inválido ou expirado' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'acesso restrito a administradores' });
  }
  next();
};

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: IS_REPLICA ? 'products-replica' : 'products' });
});

app.get('/products', (req, res) => {
  res.json(readProducts());
});

app.get('/products/:id', (req, res) => {
  const product = readProducts().find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'produto não encontrado' });
  res.json(product);
});

app.post('/products', verifyToken, requireAdmin, async (req, res) => {
  const { name, description, price, stock } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ error: 'name e price são obrigatórios' });
  }
  const product = {
    id: uuidv4(),
    name,
    description: description || '',
    price: parseFloat(price),
    stock: parseInt(stock) || 0,
    createdAt: new Date().toISOString(),
  };
  const products = readProducts();
  products.push(product);
  writeProducts(products);

  if (!IS_REPLICA) {
    const replication = await propagateToReplica('POST', '/products/replicate', product);
    if (!replication.ok) {
      console.warn(`[products] falha ao replicar produto ${product.id}`);
    }
  }

  res.status(201).json(product);
});

app.post('/products/replicate', (req, res) => {
  const product = req.body;
  if (!product || !product.id) return res.status(400).json({ error: 'payload inválido' });
  const products = readProducts();
  const exists = products.find(p => p.id === product.id);
  if (!exists) {
    products.push(product);
    writeProducts(products);
  }
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`[products${IS_REPLICA ? '-replica' : ''}] running on port ${PORT}`);
});
