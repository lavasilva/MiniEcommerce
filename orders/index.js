require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const http = require('http');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5003;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const USERS_URL = process.env.USERS_URL || 'http://localhost:5001';
const PRODUCTS_URL = process.env.PRODUCTS_URL || 'http://localhost:5002';
const DB_PATH = path.join(__dirname, 'data', 'orders.json');

const ensureDB = () => {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify([]));
};

const readOrders = () => {
  ensureDB();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
};

const writeOrders = (orders) => {
  ensureDB();
  fs.writeFileSync(DB_PATH, JSON.stringify(orders, null, 2));
};

const httpGet = (url) => {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    }).on('error', reject);
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

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'orders' });
});

app.post('/orders', verifyToken, async (req, res) => {
  const { productId, quantity } = req.body;
  if (!productId || !quantity) {
    return res.status(400).json({ error: 'productId e quantity são obrigatórios' });
  }

  try {
    const productRes = await httpGet(`${PRODUCTS_URL}/products/${productId}`);
    if (productRes.status === 404) {
      return res.status(404).json({ error: 'produto não encontrado' });
    }
    if (productRes.status !== 200) {
      return res.status(502).json({ error: 'erro ao consultar serviço de produtos' });
    }

    const product = productRes.body;
    const order = {
      id: uuidv4(),
      userId: req.user.userId,
      productId,
      productName: product.name,
      quantity: parseInt(quantity),
      unitPrice: product.price,
      total: product.price * parseInt(quantity),
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };

    const orders = readOrders();
    orders.push(order);
    writeOrders(orders);
    res.status(201).json(order);
  } catch {
    res.status(503).json({ error: 'serviço de produtos indisponível' });
  }
});

app.get('/orders/:userId', verifyToken, (req, res) => {
  if (req.user.userId !== req.params.userId && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'acesso negado' });
  }
  const orders = readOrders().filter(o => o.userId === req.params.userId);
  res.json(orders);
});

app.listen(PORT, () => {
  console.log(`[orders] running on port ${PORT}`);
});
