-- ผู้ขายตัวอย่าง 4 คน และแจกรถทุกคันที่ยังไม่มีผู้ขายให้คนละเท่าๆ กัน
-- รหัสผ่านทุกบัญชี: 123456
-- รันซ้ำได้ ไม่สร้างบัญชีซ้ำ และไม่แตะรถที่มีผู้ขายอยู่แล้ว
SET NAMES utf8mb4;

INSERT IGNORE INTO users (username, email, password, role) VALUES
  ('somchai', 'somchai@noonhomecar.test', '$2a$10$yzBMeB0GHsgxKnM6wyqzW.7QKR5SwlEU.U4DXJ/e8bG6ux7ZAej.6', 'seller'),
  ('suda',    'suda@noonhomecar.test',    '$2a$10$yzBMeB0GHsgxKnM6wyqzW.7QKR5SwlEU.U4DXJ/e8bG6ux7ZAej.6', 'seller'),
  ('wichai',  'wichai@noonhomecar.test',  '$2a$10$yzBMeB0GHsgxKnM6wyqzW.7QKR5SwlEU.U4DXJ/e8bG6ux7ZAej.6', 'seller'),
  ('malee',   'malee@noonhomecar.test',   '$2a$10$yzBMeB0GHsgxKnM6wyqzW.7QKR5SwlEU.U4DXJ/e8bG6ux7ZAej.6', 'seller');

-- รถ id ที่หาร 4 เหลือ 0 -> somchai, 1 -> suda, 2 -> wichai, 3 -> malee
UPDATE Inventory i
JOIN users u ON u.username = ELT(MOD(i.id, 4) + 1, 'somchai', 'suda', 'wichai', 'malee')
SET i.seller_id = u.id
WHERE i.seller_id IS NULL;

-- ดูผลลัพธ์: ผู้ขายแต่ละคนมีรถกี่คัน
SELECT u.username, COUNT(i.id) AS cars
FROM users u LEFT JOIN Inventory i ON i.seller_id = u.id
WHERE u.username IN ('somchai', 'suda', 'wichai', 'malee')
GROUP BY u.username;
