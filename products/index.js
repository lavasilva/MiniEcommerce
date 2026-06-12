require('dotenv').config();
const express = require('express');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5002;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'products' });
});

app.get('/products', (req, res) => {
  res.status(501).json({ message: 'not implemented yet' });
});

app.get('/products/:id', (req, res) => {
  res.status(501).json({ message: 'not implemented yet' });
});

app.post('/products', (req, res) => {
  res.status(501).json({ message: 'not implemented yet' });
});

app.listen(PORT, () => {
  console.log(`[products] running on port ${PORT}`);
});
