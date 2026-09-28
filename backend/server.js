require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const ai = require('./ai');

const app = express();
app.use(cors());
app.use(express.json());

// Car photos: GET /cars/<file>.jpg serves backend/public/cars/<file>.jpg
app.use('/cars', express.static(path.join(__dirname, 'public', 'cars'), { maxAge: '7d' }));

const JWT_SECRET = process.env.JWT_SECRET || 'mysecretkey';

// Roles: 'user' = buyer, 'seller' = can list cars, 'admin' = manages everything
const SIGNUP_ROLES = ['user', 'seller'];

const fail = (res, code, error) => res.status(code).json({ success: false, error });

// ==========================================
// Auth middleware
// ==========================================
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return fail(res, 401, 'กรุณาเข้าสู่ระบบก่อน');
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return fail(res, 401, 'การเข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบใหม่');
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return fail(res, 403, `ต้องใช้บัญชี${roles.map((r) => ({ user: 'ผู้ซื้อ', seller: 'ผู้ขาย', admin: 'แอดมิน' })[r] || r).join('หรือ')}`);
    }
    next();
  };
}

// Admins can manage every car; sellers only the cars they listed
const canManageCar = (user, car) =>
  user?.role === 'admin' || (car.seller_id != null && Number(car.seller_id) === Number(user?.id));

// ==========================================
// Car fields
// ==========================================
const TEXT_FIELDS = ['name', 'model', 'type', 'image', 'fuel', 'transmission', 'color', 'description'];
const NUMBER_FIELDS = ['price', 'stock', 'year', 'mileage', 'seats', 'engine_cc', 'fuel_economy'];
const CAR_COLUMNS = [...TEXT_FIELDS, ...NUMBER_FIELDS];

// Accepts both lower-case and Capitalized keys (the old client sent both)
function readCarBody(body = {}) {
  const pick = (key) => body[key] ?? body[key.charAt(0).toUpperCase() + key.slice(1)];
  const car = {};
  for (const key of TEXT_FIELDS) {
    const v = pick(key);
    car[key] = v == null ? '' : String(v).trim();
  }
  for (const key of NUMBER_FIELDS) {
    const v = pick(key);
    const n = v === '' || v == null ? null : Number(v);
    car[key] = Number.isFinite(n) ? n : null;
  }
  car.price = car.price ?? 0;
  car.stock = car.stock ?? 0;
  return car;
}

const CAR_SELECT = `
  SELECT i.*, u.username AS seller_name
  FROM Inventory i
  LEFT JOIN users u ON u.id = i.seller_id`;

async function findCar(id) {
  const [rows] = await db.query(`${CAR_SELECT} WHERE i.id = ?`, [id]);
  return rows[0] || null;
}

// ==========================================
// Inventory (cars)
// ==========================================
app.get('/api/inventory', async (req, res) => {
  try {
    const [rows] = await db.query(`${CAR_SELECT} ORDER BY i.id DESC`);
    res.json(rows);
  } catch (err) {
    console.error('Fetch error:', err.message);
    fail(res, 500, err.message);
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
    fail(res, 500, 'โหลดรายการรถไม่สำเร็จ');
  }
});

// Car detail (with seller name)
app.get('/api/inventory/:id', async (req, res) => {
  try {
    const car = await findCar(req.params.id);
    if (!car) return fail(res, 404, 'ไม่พบรถคันนี้');
    res.json(car);
  } catch (err) {
    console.error('Detail error:', err.message);
    fail(res, 500, err.message);
  }
});

// Sellers and admins can list cars; the car is owned by whoever created it
app.post('/api/inventory', verifyToken, requireRole('seller', 'admin'), async (req, res) => {
  try {
    const car = readCarBody(req.body);
    if (!car.name || !car.model) return fail(res, 400, 'กรุณากรอกชื่อรถและรุ่น');

    const columns = [...CAR_COLUMNS, 'seller_id'];
    const values = [...CAR_COLUMNS.map((c) => car[c]), req.user.id];
    const [result] = await db.query(
      `INSERT INTO Inventory (${columns.map((c) => `\`${c}\``).join(', ')})
       VALUES (${columns.map(() => '?').join(', ')})`,
      values
    );
    res.json({ success: true, insertId: result.insertId });
  } catch (err) {
    console.error('Insert error:', err.message);
    fail(res, 500, err.message);
  }
});

app.put('/api/inventory/:id', verifyToken, async (req, res) => {
  try {
    const existing = await findCar(req.params.id);
    if (!existing) return fail(res, 404, 'ไม่พบรถคันนี้');
    if (!canManageCar(req.user, existing)) return fail(res, 403, 'แก้ไขได้เฉพาะรถที่คุณลงขายเอง');

    const car = readCarBody(req.body);
    if (!car.name || !car.model) return fail(res, 400, 'กรุณากรอกชื่อรถและรุ่น');

    const [result] = await db.query(
      `UPDATE Inventory SET ${CAR_COLUMNS.map((c) => `\`${c}\` = ?`).join(', ')} WHERE id = ?`,
      [...CAR_COLUMNS.map((c) => car[c]), req.params.id]
    );
    res.json({ success: true, affectedRows: result.affectedRows });
  } catch (err) {
    console.error('Update error:', err.message);
    fail(res, 500, err.message);
  }
});

app.delete('/api/inventory/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await findCar(id);
    if (!existing) return fail(res, 404, 'ไม่พบรถคันนี้');
    if (!canManageCar(req.user, existing)) return fail(res, 403, 'ลบได้เฉพาะรถที่คุณลงขายเอง');

    // Clean up chats about this car too
    await db.query('DELETE m FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.car_id = ?', [id]);
    await db.query('DELETE a FROM appointments a JOIN conversations c ON c.id = a.conversation_id WHERE c.car_id = ?', [id]);
    await db.query('DELETE FROM conversations WHERE car_id = ?', [id]);
    await db.query('DELETE FROM Inventory WHERE id = ?', [id]);

    res.json({ success: true, message: 'Car deleted successfully' });
  } catch (err) {
    console.error('Delete error:', err.message);
    fail(res, 500, 'ลบรถไม่สำเร็จ: ' + err.message);
  }
});

// ==========================================
// Register — buyer ('user') or seller; password is hashed
// ==========================================
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return fail(res, 400, 'กรุณากรอกชื่อผู้ใช้ อีเมล และรหัสผ่าน');
    }
    const role = SIGNUP_ROLES.includes(req.body.role) ? req.body.role : 'user';

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, role]
    );

    res.json({ success: true, message: 'User registered successfully', userId: result.insertId });
  } catch (err) {
    console.error('Register error:', err.message);
    if (err.code === 'ER_DUP_ENTRY') return fail(res, 400, 'ชื่อผู้ใช้หรืออีเมลนี้มีคนใช้แล้ว');
    fail(res, 500, 'สมัครสมาชิกไม่สำเร็จ: ' + err.message);
  }
});

// ==========================================
// Login — compares against the hash and returns a JWT
// ==========================================
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return fail(res, 400, 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');

    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) return fail(res, 401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');

    const user = rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) return fail(res, 401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (err) {
    console.error('Login error:', err.message);
    fail(res, 500, 'เซิร์ฟเวอร์ขัดข้อง: ' + err.message);
  }
});

// ==========================================
// Customer contact — conversations, messages, appointments
// ==========================================
async function loadConversation(id, userId) {
  const [rows] = await db.query(
    `SELECT c.*, i.name AS car_name, i.image AS car_image, i.price AS car_price,
            b.username AS buyer_name, s.username AS seller_name
     FROM conversations c
     JOIN Inventory i ON i.id = c.car_id
     JOIN users b ON b.id = c.buyer_id
     JOIN users s ON s.id = c.seller_id
     WHERE c.id = ?`,
    [id]
  );
  const conv = rows[0];
  if (!conv) return null;
  const me = Number(userId);
  if (Number(conv.buyer_id) !== me && Number(conv.seller_id) !== me) return null; // participants only
  return conv;
}

const touchConversation = (id) => db.query('UPDATE conversations SET updated_at = NOW() WHERE id = ?', [id]);

// Buyer starts (or reopens) a chat about a car
app.post('/api/conversations', verifyToken, async (req, res) => {
  try {
    const carId = Number(req.body.carId);
    const message = String(req.body.message || '').trim();

    const [cars] = await db.query('SELECT id, seller_id FROM Inventory WHERE id = ?', [carId]);
    if (!cars.length) return fail(res, 404, 'ไม่พบรถคันนี้');

    // Cars listed before sellers existed belong to the shop — route to an admin
    let sellerId = cars[0].seller_id;
    if (sellerId == null) {
      const [admins] = await db.query("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1");
      if (!admins.length) return fail(res, 400, 'รถคันนี้ยังไม่มีผู้ขายให้ติดต่อ');
      sellerId = admins[0].id;
    }
    if (Number(sellerId) === Number(req.user.id)) return fail(res, 400, 'นี่คือรถที่คุณลงขายเอง');

    // LAST_INSERT_ID(id) makes insertId return the existing row on duplicate
    const [result] = await db.query(
      `INSERT INTO conversations (car_id, buyer_id, seller_id) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      [carId, req.user.id, sellerId]
    );
    const conversationId = result.insertId;

    if (message) {
      await db.query('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)', [conversationId, req.user.id, message]);
      await touchConversation(conversationId);
    }
    res.json({ success: true, conversationId });
  } catch (err) {
    console.error('Start conversation error:', err.message);
    fail(res, 500, 'ติดต่อผู้ขายไม่สำเร็จ');
  }
});

// Inbox — every conversation I'm part of, as buyer or seller
app.get('/api/conversations', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.id, c.car_id, c.buyer_id, c.seller_id, c.updated_at,
              i.name AS car_name, i.image AS car_image, i.price AS car_price,
              b.username AS buyer_name, s.username AS seller_name,
              (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
              (SELECT COUNT(*) FROM appointments a WHERE a.conversation_id = c.id AND a.status = 'pending') AS pending_appointments
       FROM conversations c
       JOIN Inventory i ON i.id = c.car_id
       JOIN users b ON b.id = c.buyer_id
       JOIN users s ON s.id = c.seller_id
       WHERE c.buyer_id = ? OR c.seller_id = ?
       ORDER BY c.updated_at DESC`,
      [req.user.id, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Inbox error:', err.message);
    fail(res, 500, 'โหลดรายการแชทไม่สำเร็จ');
  }
});

app.get('/api/conversations/:id', verifyToken, async (req, res) => {
  try {
    const conv = await loadConversation(req.params.id, req.user.id);
    if (!conv) return fail(res, 404, 'ไม่พบแชทนี้');

    const [messages] = await db.query(
      'SELECT id, sender_id, body, created_at FROM messages WHERE conversation_id = ? ORDER BY id ASC',
      [conv.id]
    );
    const [appointments] = await db.query(
      `SELECT id, proposed_by, DATE_FORMAT(appointment_at, '%Y-%m-%d %H:%i') AS appointment_at,
              location, note, status, created_at
       FROM appointments WHERE conversation_id = ? ORDER BY appointment_at ASC`,
      [conv.id]
    );
    res.json({ success: true, conversation: conv, messages, appointments });
  } catch (err) {
    console.error('Conversation error:', err.message);
    fail(res, 500, 'โหลดแชทไม่สำเร็จ');
  }
});

app.post('/api/conversations/:id/messages', verifyToken, async (req, res) => {
  try {
    const conv = await loadConversation(req.params.id, req.user.id);
    if (!conv) return fail(res, 404, 'ไม่พบแชทนี้');
    const body = String(req.body.body || '').trim();
    if (!body) return fail(res, 400, 'กรุณาพิมพ์ข้อความ');
    if (body.length > 2000) return fail(res, 400, 'ข้อความยาวเกินไป');

    const [result] = await db.query('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)', [conv.id, req.user.id, body]);
    await touchConversation(conv.id);
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('Send message error:', err.message);
    fail(res, 500, 'ส่งข้อความไม่สำเร็จ');
  }
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Either side can propose a meeting (viewing / test drive)
app.post('/api/conversations/:id/appointments', verifyToken, async (req, res) => {
  try {
    const conv = await loadConversation(req.params.id, req.user.id);
    if (!conv) return fail(res, 404, 'ไม่พบแชทนี้');

    const date = String(req.body.date || '').trim();
    const time = String(req.body.time || '').trim();
    const location = String(req.body.location || '').trim();
    const note = String(req.body.note || '').trim() || null;

    if (!DATE_RE.test(date) || !TIME_RE.test(time)) return fail(res, 400, 'กรุณาใส่วันที่แบบ YYYY-MM-DD และเวลาแบบ HH:MM');
    const when = new Date(`${date}T${time}:00`);
    if (Number.isNaN(when.getTime())) return fail(res, 400, 'วันที่ไม่ถูกต้อง');
    if (when.getTime() < Date.now()) return fail(res, 400, 'วันนัดต้องเป็นวันในอนาคต');
    if (!location) return fail(res, 400, 'กรุณาระบุสถานที่นัด');

    const [result] = await db.query(
      'INSERT INTO appointments (conversation_id, proposed_by, appointment_at, location, note) VALUES (?, ?, ?, ?, ?)',
      [conv.id, req.user.id, `${date} ${time}:00`, location, note]
    );
    await touchConversation(conv.id);
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('Appointment error:', err.message);
    fail(res, 500, 'สร้างนัดไม่สำเร็จ');
  }
});

// The other side accepts/declines; the proposer can cancel
app.patch('/api/appointments/:id', verifyToken, async (req, res) => {
  try {
    const status = req.body.status;
    if (!['accepted', 'declined', 'cancelled'].includes(status)) return fail(res, 400, 'สถานะไม่ถูกต้อง');

    const [rows] = await db.query('SELECT * FROM appointments WHERE id = ?', [req.params.id]);
    const appt = rows[0];
    if (!appt) return fail(res, 404, 'ไม่พบนัดหมายนี้');
    const conv = await loadConversation(appt.conversation_id, req.user.id);
    if (!conv) return fail(res, 404, 'ไม่พบนัดหมายนี้');

    const isProposer = Number(appt.proposed_by) === Number(req.user.id);
    if (status === 'cancelled') {
      if (!isProposer) return fail(res, 403, 'ยกเลิกได้เฉพาะคนที่เสนอนัด');
      if (!['pending', 'accepted'].includes(appt.status)) return fail(res, 400, 'นัดนี้ปิดไปแล้ว');
    } else {
      if (isProposer) return fail(res, 403, 'กำลังรออีกฝ่ายตอบกลับ');
      if (appt.status !== 'pending') return fail(res, 400, 'นัดนี้ถูกตอบไปแล้ว');
    }

    await db.query('UPDATE appointments SET status = ? WHERE id = ?', [status, appt.id]);
    await touchConversation(conv.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Update appointment error:', err.message);
    fail(res, 500, 'อัปเดตนัดหมายไม่สำเร็จ');
  }
});

// ==========================================
// AI — recommendation & comparison
// ==========================================
app.post('/api/ai/recommend', async (req, res) => {
  try {
    const prefs = req.body || {};
    const [rows] = await db.query(CAR_SELECT);
    const result = ai.recommend(rows, prefs);
    const summary = await ai.summarizeRecommendation(prefs, result);
    res.json({ success: true, ...result, summary: summary.text, summarySource: summary.source });
  } catch (err) {
    console.error('AI recommend error:', err.message);
    fail(res, 500, 'AI วิเคราะห์ไม่สำเร็จ');
  }
});

app.post('/api/ai/compare', async (req, res) => {
  try {
    const rawIds = Array.isArray(req.body.ids) ? req.body.ids : String(req.body.ids || '').split(',');
    const ids = [...new Set(rawIds.map(Number).filter(Number.isFinite))];
    if (ids.length < 2 || ids.length > 4) return fail(res, 400, 'กรุณาเลือกรถ 2–4 คันเพื่อเปรียบเทียบ');

    const [rows] = await db.query(CAR_SELECT);
    const result = ai.compare(rows, ids, req.body.priorities || {});
    if (result.cars.length < 2) return fail(res, 404, 'รถบางคันที่เลือกไม่มีในระบบแล้ว');

    const summary = await ai.summarizeComparison(result);
    res.json({ success: true, ...result, summary: summary.text, summarySource: summary.source });
  } catch (err) {
    console.error('AI compare error:', err.message);
    fail(res, 500, 'เปรียบเทียบไม่สำเร็จ');
  }
});

const PORT = process.env.PORT || 3092;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) console.log('AI summaries: rule-based (set ANTHROPIC_API_KEY to use Claude)');
});
