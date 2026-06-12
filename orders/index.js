require('dotenv').config();
const express = require('express');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5003;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'orders' });
});

app.post('/orders', (req, res) => {
  res.status(501).json({ message: 'not implemented yet' });
});

app.get('/orders/:userId', (req, res) => {
  res.status(501).json({ message: 'not implemented yet' });
});

app.listen(PORT, () => {
  console.log(`[orders] running on port ${PORT}`);
});
