// Chatbot API: POST /api/ai/chat  { messages: [{ role, content }] } -> { reply }
// Rule-based (no API key needed). Reuses ai.recommend() from ./ai so the chat
// gives the same scores as the "แนะนำรถ" page.
const express = require('express');

const fmt = (n) => `${Math.round(Number(n) || 0).toLocaleString()} บาท`;

// "งบ 900000" / "9 แสน" / "1.2 ล้าน" / "5 หมื่น" -> number (or null)
function parseBudget(text) {
  const t = text.replace(/,/g, '');
  let m = t.match(/(\d+(?:\.\d+)?)\s*ล้าน/);
  if (m) return Math.round(Number(m[1]) * 1_000_000);
  m = t.match(/(\d+(?:\.\d+)?)\s*แสน/);
  if (m) return Math.round(Number(m[1]) * 100_000);
  m = t.match(/(\d+(?:\.\d+)?)\s*หมื่น/);
  if (m) return Math.round(Number(m[1]) * 10_000);
  m = t.match(/\d{5,8}/); // plain number such as 900000
  if (m) return Number(m[0]);
  return null;
}

const USAGE_WORDS = {
  family: ['ครอบครัว', 'พาลูก', 'หลายคน', 'family'],
  city: ['ในเมือง', 'กรุงเทพ', 'รถติด', 'city'],
  long_trip: ['ทางไกล', 'เดินทางไกล', 'ต่างจังหวัด', 'ข้ามจังหวัด'],
  offroad: ['ออฟโรด', 'ลุย', 'ขึ้นเขา', 'บรรทุก', 'กระบะ'],
  performance: ['สปอร์ต', 'สมรรถนะ', 'ขับสนุก', 'แรง'],
  economy: ['ประหยัด', 'ค่าใช้จ่ายต่ำ', 'ค่าน้ำมันน้อย'],
};

const FUEL_WORDS = [
  ['Hybrid', ['ไฮบริด', 'hybrid']],
  ['Diesel', ['ดีเซล', 'diesel']],
  ['EV', ['ไฟฟ้า', 'ev']],
  ['Petrol', ['เบนซิน', 'petrol']],
];

function parsePrefs(text) {
  const lower = text.toLowerCase();
  const usages = Object.entries(USAGE_WORDS)
    .filter(([, words]) => words.some((w) => lower.includes(w)))
    .map(([key]) => key);
  const fuel = (FUEL_WORDS.find(([, words]) => words.some((w) => lower.includes(w))) || ['Any'])[0];
  const transmission = /เกียร์ธรรมดา|manual/i.test(text) ? 'Manual' : /เกียร์ออโต้|อัตโนมัติ|auto/i.test(text) ? 'Automatic' : 'Any';
  const pax = text.match(/(\d+)\s*(?:คน|ที่นั่ง)/);
  return {
    budget: parseBudget(text),
    monthlyIncome: null,
    passengers: pax ? Number(pax[1]) : null,
    usages,
    fuel,
    transmission,
    notes: '',
  };
}

const HELP_CONTACT =
  'วิธีติดต่อผู้ขายและนัดดูรถ:\n' +
  '1) เลือกรถที่สนใจแล้วกด "ติดต่อผู้ขาย / นัดดูรถ"\n' +
  '2) พิมพ์ข้อความแล้วกดส่ง ระบบจะเปิดแชทกับผู้ขาย\n' +
  '3) ในแชท เสนอวัน เวลา และสถานที่นัดได้ ผู้ขายจะกดยอมรับหรือปฏิเสธ\n' +
  'ดูแชททั้งหมดได้ที่เมนู "ข้อความ" (ต้องเข้าสู่ระบบก่อน)';

const HELP_GENERAL =
  'ผมช่วยได้สองเรื่อง:\n' +
  '• แนะนำรถตามงบและการใช้งาน เช่น "งบ 9 แสน ใช้กับครอบครัว 5 คน" หรือ "งบ 500000 ประหยัดน้ำมัน"\n' +
  '• บอกขั้นตอนติดต่อผู้ขายและนัดดูรถ';

module.exports = function createChatRouter({ db, ai, verifyToken, carSelect }) {
  const router = express.Router();

  router.post('/', verifyToken, async (req, res) => {
    try {
      const messages = Array.isArray(req.body.messages) ? req.body.messages : [];
      const last = [...messages].reverse().find((m) => m && m.role === 'user');
      const text = String((last && last.content) || '').trim().slice(0, 500);
      if (!text) return res.status(400).json({ success: false, error: 'กรุณาพิมพ์ข้อความ' });

      if (/ติดต่อ|นัด|ดูรถ|ทดลองขับ|แชท|ผู้ขาย/.test(text) && !/งบ|แสน|ล้าน/.test(text)) {
        return res.json({ success: true, reply: HELP_CONTACT });
      }

      const prefs = parsePrefs(text);
      if (!prefs.budget && prefs.usages.length === 0) {
        return res.json({ success: true, reply: `ขอข้อมูลเพิ่มนิดนึงครับ ว่างบประมาณเท่าไหร่ หรือจะใช้รถทำอะไร\n\n${HELP_GENERAL}` });
      }

      const [rows] = await db.query(carSelect);
      const result = ai.recommend(rows, prefs);
      const top = (result.results || []).slice(0, 3);
      if (!top.length) {
        return res.json({ success: true, reply: 'ตอนนี้ยังไม่พบรถที่ตรงกับเงื่อนไขในสต็อก ลองเพิ่มงบหรือลดเงื่อนไขดูนะครับ' });
      }

      const lines = top.map((r, i) => {
        const c = r.car;
        const why = (r.reasons || []).slice(0, 2).join(', ');
        const stretch = r.budgetStatus === 'stretch' ? ' (เกินงบเล็กน้อย)' : '';
        return `${i + 1}. ${c.name} ${c.model || ''}`.trim() + ` ปี ${c.year ?? '-'}\n   ${fmt(c.price)}${stretch}${why ? `\n   ✓ ${why}` : ''}`;
      });
      const budgetLine = prefs.budget ? `จากงบ ${fmt(prefs.budget)} ` : '';
      const reply = `${budgetLine}รถที่น่าสนใจ ${top.length} คันครับ\n\n${lines.join('\n\n')}\n\nดูรายละเอียดทั้งหมดและเปรียบเทียบได้ที่หน้า "แนะนำรถให้คุณ" ครับ`;
      res.json({ success: true, reply });
    } catch (err) {
      console.error('Chat error:', err.message);
      res.status(500).json({ success: false, error: 'ตอนนี้ตอบไม่ได้ ลองใหม่อีกครั้งครับ' });
    }
  });

  return router;
};
