require('dotenv').config();
const express = require('express');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5001;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'users' });
});

app.post('/users/register', (req, res) => {
  res.status(501).json({ message: 'not implemented yet' });
});

app.post('/users/login', (req, res) => {
  res.status(501).json({ message: 'not implemented yet' });
});

app.get('/users/:id', (req, res) => {
  res.status(501).json({ message: 'not implemented yet' });
});

app.listen(PORT, () => {
  console.log(`[users] running on port ${PORT}`);
});
