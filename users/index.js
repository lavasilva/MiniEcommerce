require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const DB_PATH = path.join(__dirname, 'data', 'users.json');

const ensureDB = () => {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify([]));
};

const readUsers = () => {
  ensureDB();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
};

const writeUsers = (users) => {
  ensureDB();
  fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2));
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
  res.json({ status: 'ok', service: 'users' });
});

app.post('/users/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email e password são obrigatórios' });
  }
  const users = readUsers();
  if (users.find(u => u.email === email)) {
    return res.status(409).json({ error: 'email já cadastrado' });
  }
  const hash = await bcrypt.hash(password, 10);
  const user = {
    id: uuidv4(),
    name,
    email,
    password: hash,
    role: role === 'admin' ? 'admin' : 'user',
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  writeUsers(users);
  const { password: _, ...safeUser } = user;
  res.status(201).json(safeUser);
});

app.post('/users/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email e password são obrigatórios' });
  }
  const users = readUsers();
  const user = users.find(u => u.email === email);
  if (!user) return res.status(401).json({ error: 'credenciais inválidas' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'credenciais inválidas' });

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
  res.json({ token });
});

app.get('/users/:id', verifyToken, (req, res) => {
  const users = readUsers();
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'usuário não encontrado' });
  const { password: _, ...safeUser } = user;
  res.json(safeUser);
});

app.listen(PORT, () => {
  console.log(`[users] running on port ${PORT}`);
});
