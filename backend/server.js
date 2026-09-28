require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'mysecretkey';

// ==========================================
// Auth middleware
// ==========================================
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, error: 'Missing token' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
}

// ==========================================
// Inventory (cars)
// Columns exactly as they are in MySQL: id, name, model, type, price, image, stock
// ==========================================
app.get('/api/inventory', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Inventory ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    console.error('Fetch error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/inventory/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let sql = 'SELECT * FROM Inventory';
    let countSql = 'SELECT COUNT(*) AS total FROM Inventory';
    let params = [];

    if (q) {
      const clause = ' WHERE name LIKE ? OR model LIKE ? OR type LIKE ?';
      sql += clause;
      countSql += clause;
      const term = `%${q}%`;
      params = [term, term, term];
    }
    sql += ' LIMIT ? OFFSET ?';

    const [items] = await db.query(sql, [...params, limit, offset]);
    const [totalResult] = await db.query(countSql, params);

    res.json({ items, total: totalResult[0].total, page, limit });
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch inventory' });
  }
});

// Only a logged-in admin can create/edit/delete cars
app.post('/api/inventory', verifyToken, requireAdmin, async (req, res) => {
  try {
    const name = req.body.name || req.body.Name || '';
    const model = req.body.model || req.body.Model || '';
    const type = req.body.type || req.body.Type || '';
    const price = req.body.price ?? req.body.Price ?? 0;
    const image = req.body.image || req.body.Image || '';
    const stock = req.body.stock ?? req.body.Stock ?? 0;

    const [result] = await db.query(
      `INSERT INTO Inventory (name, model, type, price, image, stock)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, model, type, Number(price), image, Number(stock)]
    );
    res.json({ success: true, insertId: result.insertId });
  } catch (err) {
    console.error('Insert error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/inventory/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const carId = req.params.id;
    const name = req.body.name || req.body.Name || '';
    const model = req.body.model || req.body.Model || '';
    const type = req.body.type || req.body.Type || '';
    const price = req.body.price ?? req.body.Price ?? 0;
    const image = req.body.image || req.body.Image || '';
    const stock = req.body.stock ?? req.body.Stock ?? 0;

    const [result] = await db.query(
      `UPDATE Inventory
       SET name = ?, model = ?, type = ?, price = ?, image = ?, stock = ?
       WHERE id = ?`,
      [name, model, type, Number(price), image, Number(stock), carId]
    );
    res.json({ success: true, affectedRows: result.affectedRows });
  } catch (err) {
    console.error('Update error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/inventory/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM Inventory WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Car not found' });
    }
    res.json({ success: true, message: 'Car deleted successfully' });
  } catch (err) {
    console.error('Delete error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to delete car: ' + err.message });
  }
});

// ==========================================
// Register — password is hashed before it's stored
// ==========================================
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, error: 'Username, email and password are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, 'user']
    );

    res.json({ success: true, message: 'User registered successfully', userId: result.insertId });
  } catch (err) {
    console.error('Register error:', err.message);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, error: 'Username or email already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to register: ' + err.message });
  }
});

// ==========================================
// Login — compares against the hash and returns a JWT
// ==========================================
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    const user = rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ success: false, error: 'Server error: ' + err.message });
  }
});

const PORT = process.env.PORT || 3092;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
