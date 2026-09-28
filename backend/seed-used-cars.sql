-- รถมือสองตัวอย่าง 22 คัน พร้อมรูป (รูปอยู่ใน backend/public/cars/)
-- รันได้ครั้งเดียว ถ้ารันซ้ำรถจะเพิ่มซ้ำ
SET NAMES utf8mb4;

-- ให้ตารางเก็บภาษาไทยได้ (ถ้าเป็น utf8mb4 อยู่แล้วคำสั่งนี้ไม่เปลี่ยนอะไร)
ALTER TABLE Inventory CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE messages CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE appointments CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO Inventory
  (name, model, type, price, image, stock, `year`, mileage, fuel, transmission, seats, engine_cc, fuel_economy, color, description)
VALUES
  ('Toyota Camry', '2.5 HEV Premium', 'Sedan', 1020000, '/cars/toyota-camry-2020.jpg', 1, 2020, 78000, 'Hybrid', 'Automatic', 5, 2500, 21.3, 'Black', 'มือเดียว เข้าศูนย์โตโยต้าตลอด ไม่มีชนหนัก ไม่เคยจมน้ำ ภายในสะอาดมาก'),
  ('Toyota Vios', '1.5 Entry', 'Sedan', 329000, '/cars/toyota-vios-2019.jpg', 2, 2019, 95000, 'Petrol', 'Automatic', 5, 1500, 17.5, 'White', 'รถบ้านใช้งานในเมือง ประหยัดน้ำมัน เปลี่ยนยางใหม่ 4 เส้น'),
  ('Honda Accord', '2.0 e:HEV EL', 'Sedan', 1290000, '/cars/honda-accord-2021.jpg', 1, 2021, 45000, 'Hybrid', 'Automatic', 5, 2000, 22.2, 'Grey', 'ไมล์น้อย ยังอยู่ในประกันแบตเตอรี่ไฮบริด ออปชันครบ'),
  ('Honda Jazz', '1.5 RS', 'Hatchback', 399000, '/cars/honda-jazz-2018.jpg', 2, 2018, 88000, 'Petrol', 'Automatic', 5, 1500, 17, 'Blue', 'เบาะพับได้หลายแบบ ขนของได้เยอะ สภาพเดิม ไม่เคยแต่ง'),
  ('Mazda CX-5', '2.0 SP', 'SUV', 789000, '/cars/mazda-cx-5-2020.jpg', 1, 2020, 62000, 'Petrol', 'Automatic', 5, 2000, 14.5, 'Red', 'สีแดงโซลเรด ช่วงล่างแน่น มีกล้องรอบคัน ประวัติศูนย์ครบ'),
  ('Mazda 3', '2.0 SP Sports', 'Hatchback', 699000, '/cars/mazda-3-2020.jpg', 1, 2020, 55000, 'Petrol', 'Automatic', 5, 2000, 15.4, 'Grey', 'ตัวท็อป ห้องโดยสารเงียบ มีระบบความปลอดภัย i-Activsense'),
  ('Nissan Almera', '1.0 Turbo VL', 'Sedan', 459000, '/cars/nissan-almera-2021.jpg', 3, 2021, 41000, 'Petrol', 'Automatic', 5, 1000, 23.3, 'Silver', 'เครื่องเทอร์โบประหยัดมาก เหมาะกับคนเริ่มมีรถคันแรก'),
  ('Nissan Navara', 'Double Cab Calibre', 'Pickup', 629000, '/cars/nissan-navara-2019.jpg', 1, 2019, 110000, 'Diesel', 'Automatic', 5, 2300, 14, 'Grey', 'กระบะ 4 ประตู ยกสูง ใช้งานเดินทางต่างจังหวัด เช็กระยะตรงเวลา'),
  ('Mitsubishi Pajero Sport', '2.4 GT Premium', 'SUV', 889000, '/cars/mitsubishi-pajero-sport-2019.jpg', 1, 2019, 98000, 'Diesel', 'Automatic', 7, 2400, 12.5, 'Black', '7 ที่นั่ง ขับ 4 ล้อ เหมาะกับครอบครัวใหญ่และทริปต่างจังหวัด'),
  ('Mitsubishi Triton', 'Double Cab Athlete', 'Pickup', 779000, '/cars/mitsubishi-triton-2021.jpg', 2, 2021, 52000, 'Diesel', 'Automatic', 5, 2400, 14.5, 'Orange', 'รุ่นแต่งพิเศษจากโรงงาน ไม่เคยบรรทุกหนัก ยางยังเหลือเยอะ'),
  ('Ford Ranger', 'Raptor 2.0 Bi-Turbo', 'Pickup', 1190000, '/cars/ford-ranger-2019.jpg', 1, 2019, 87000, 'Diesel', 'Automatic', 5, 2000, 11.8, 'Blue', 'ช่วงล่าง Fox ออฟโรดได้จริง ดูแลอย่างดี ไม่เคยลุยหนัก'),
  ('Ford Everest', '2.0 Titanium+', 'SUV', 1090000, '/cars/ford-everest-2020.jpg', 1, 2020, 76000, 'Diesel', 'Automatic', 7, 2000, 12.8, 'White', 'ซันรูฟ เบาะไฟฟ้า 7 ที่นั่ง เข้าศูนย์ฟอร์ดทุกระยะ'),
  ('Isuzu MU-X', '3.0 Ultimate', 'SUV', 1050000, '/cars/isuzu-mu-x-2021.jpg', 1, 2021, 60000, 'Diesel', 'Automatic', 7, 3000, 13, 'Silver', 'เครื่อง 3.0 แรงและทน อะไหล่หาง่าย ค่าซ่อมบำรุงไม่แพง'),
  ('Suzuki Swift', '1.2 GLX', 'Hatchback', 419000, '/cars/suzuki-swift-2020.jpg', 2, 2020, 47000, 'Petrol', 'Automatic', 5, 1200, 21, 'Yellow', 'รถเล็กขับง่าย จอดง่าย ประหยัดน้ำมัน เหมาะกับขับในเมือง'),
  ('Toyota Hilux Revo', 'Smart Cab Z-Edition', 'Pickup', 539000, '/cars/toyota-hilux-revo-2019.jpg', 2, 2019, 128000, 'Diesel', 'Manual', 4, 2400, 15, 'White', 'กระบะแคบ เกียร์ธรรมดา ใช้งานบรรทุกได้ดี เครื่องเดิมไม่เคยผ่า'),
  ('MG ZS EV', 'Standard', 'SUV', 599000, '/cars/mg-zs-ev-2021.jpg', 2, 2021, 39000, 'EV', 'Automatic', 5, NULL, NULL, 'Blue', 'รถไฟฟ้า 100% วิ่งได้ประมาณ 260 กม. ต่อการชาร์จ แถมสายชาร์จบ้าน'),
  ('BMW 320d', 'M Sport (G20)', 'Sedan', 1590000, '/cars/bmw-320d-2020.jpg', 1, 2020, 68000, 'Diesel', 'Automatic', 5, 2000, 17.2, 'White', 'รถนำเข้า ประวัติศูนย์ BMW ครบ ขับสนุก ประหยัดดีเซล'),
  ('Mercedes-Benz C220d', 'AMG Dynamic', 'Sedan', 1390000, '/cars/mercedes-benz-c220d-2019.jpg', 1, 2019, 81000, 'Diesel', 'Automatic', 5, 2000, 16.1, 'Silver', 'ชุดแต่ง AMG รอบคัน ภายในหนังแท้ มีประวัติเข้าศูนย์ Benz'),
  ('Porsche 718 Cayman', 'PDK', 'Sports Car', 3990000, '/cars/porsche-718-cayman-2018.jpg', 1, 2018, 34000, 'Petrol', 'Automatic', 2, 2000, 11, 'Yellow', 'รถสปอร์ตเครื่องกลางลำ จอดในร่มตลอด ไมล์น้อยมาก'),
  ('Honda CR-V', '2.4 EL 4WD', 'SUV', 749000, '/cars/honda-cr-v-2018.jpg', 1, 2018, 102000, 'Petrol', 'Automatic', 7, 2400, 12, 'Brown', '7 ที่นั่ง ขับ 4 ล้อ นั่งสบาย เหมาะกับครอบครัว'),
  ('Toyota Yaris', '1.2 Sport', 'Hatchback', 479000, '/cars/toyota-yaris-2022.jpg', 3, 2022, 28000, 'Petrol', 'Automatic', 5, 1200, 21, 'Red', 'ไมล์น้อยมาก ยังอยู่ในประกันศูนย์ สภาพเหมือนรถใหม่'),
  ('Subaru BRZ', '2.0 MT', 'Sports Car', 1290000, '/cars/subaru-brz-2017.jpg', 1, 2017, 52000, 'Petrol', 'Manual', 4, 2000, 12.5, 'Blue', 'ขับหลัง เกียร์ธรรมดา ขับสนุกมาก เจ้าของเดิมดูแลดี');

-- ใส่รูปและคำอธิบายภาษาไทยให้รถจาก seed-demo.sql (ถ้าเคยรันไว้) เฉพาะคันที่ยังไม่มีรูป
UPDATE Inventory SET image = '/cars/honda-civic-fe-2023.jpg', description = 'มือเดียว ประวัติศูนย์ครบ ไมล์น้อย' WHERE name = 'Honda Civic FE' AND `year` = 2023 AND (image IS NULL OR image = '');
UPDATE Inventory SET image = '/cars/toyota-yaris-ativ-2022.jpg', description = 'ซีดานประหยัดน้ำมัน เหมาะกับขับในเมือง' WHERE name = 'Toyota Yaris Ativ' AND `year` = 2022 AND (image IS NULL OR image = '');
UPDATE Inventory SET image = '/cars/toyota-corolla-cross-2023.jpg', description = 'SUV ไฮบริด ค่าน้ำมันต่ำมาก' WHERE name = 'Toyota Corolla Cross' AND `year` = 2023 AND (image IS NULL OR image = '');
UPDATE Inventory SET image = '/cars/honda-hr-v-2022.jpg', description = 'มีซันรูฟ และระบบ Honda Sensing' WHERE name = 'Honda HR-V' AND `year` = 2022 AND (image IS NULL OR image = '');
UPDATE Inventory SET image = '/cars/toyota-fortuner-2021.jpg', description = '7 ที่นั่ง ขับ 4 ล้อ เหมาะกับทริปครอบครัว' WHERE name = 'Toyota Fortuner' AND `year` = 2021 AND (image IS NULL OR image = '');
UPDATE Inventory SET image = '/cars/isuzu-d-max-2022.jpg', description = 'กระบะ 4 ประตู ขับ 4 ล้อ' WHERE name = 'Isuzu D-Max' AND `year` = 2022 AND (image IS NULL OR image = '');
UPDATE Inventory SET image = '/cars/toyota-hilux-revo-2020.jpg', description = 'กระบะทนทาน ใช้งานหนักได้' WHERE name = 'Toyota Hilux Revo' AND `year` = 2020 AND (image IS NULL OR image = '');
UPDATE Inventory SET image = '/cars/mazda-2-2021.jpg', description = 'จอดง่าย ขับสนุก' WHERE name = 'Mazda 2' AND `year` = 2021 AND (image IS NULL OR image = '');
UPDATE Inventory SET image = '/cars/honda-city-hatchback-2023.jpg', description = 'เครื่องเทอร์โบ 1.0 สภาพเหมือนใหม่' WHERE name = 'Honda City Hatchback' AND `year` = 2023 AND (image IS NULL OR image = '');
UPDATE Inventory SET image = '/cars/byd-atto-3-2023.jpg', description = 'วิ่งได้ 480 กม. ต่อการชาร์จ แถมที่ชาร์จบ้าน' WHERE name = 'BYD Atto 3' AND `year` = 2023 AND (image IS NULL OR image = '');
UPDATE Inventory SET image = '/cars/ford-mustang-2020.jpg', description = 'รถสปอร์ตสะดุดตา จอดในร่มตลอด' WHERE name = 'Ford Mustang' AND `year` = 2020 AND (image IS NULL OR image = '');
UPDATE Inventory SET image = '/cars/mazda-mx-5-2019.jpg', description = 'หลังคาแข็งเปิดประทุนได้' WHERE name = 'Mazda MX-5' AND `year` = 2019 AND (image IS NULL OR image = '');
UPDATE Inventory SET image = '/cars/mitsubishi-xpander-2022.jpg', description = '7 ที่นั่งราคาประหยัด' WHERE name = 'Mitsubishi Xpander' AND `year` = 2022 AND (image IS NULL OR image = '');
