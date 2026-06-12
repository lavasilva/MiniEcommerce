require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const SERVICES = {
  users:    { url: process.env.USERS_URL    || 'http://localhost:5001', status: 'unknown' },
  products: { url: process.env.PRODUCTS_URL || 'http://localhost:5002', status: 'unknown' },
  orders:   { url: process.env.ORDERS_URL   || 'http://localhost:5003', status: 'unknown' },
};

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'gateway' });
});

app.get('/status', (req, res) => {
  res.json({ services: SERVICES });
});

app.listen(PORT, () => {
  console.log(`[gateway] running on port ${PORT}`);
});
