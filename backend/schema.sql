-- ตาราง Inventory มีอยู่แล้ว (id, name, model, type, price, image, stock) ตามที่เห็นใน phpMyAdmin
-- สร้างเพิ่มเฉพาะตาราง users สำหรับระบบ login / register / role

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- วิธีสร้างแอดมินคนแรก:
-- 1) สมัครสมาชิกผ่าน POST /api/auth/register ตามปกติ (จะได้ role = user)
-- 2) เข้า phpMyAdmin -> ตาราง users -> แก้ไข field role ของ user นั้นเป็น 'admin'
