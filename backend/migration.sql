-- ============================================================
-- Noon Home Car — migration for: sellers, car details, contact
-- system and appointments. Run ONCE against your existing DB.
-- ============================================================

-- 1) Roles: 'user' = buyer (existing accounts stay buyers),
--    'seller' = can list cars, 'admin' = manages everything.
--    (If role was an ENUM('user','admin') this widens it.)
ALTER TABLE users MODIFY COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user';

-- 2) Seller ownership + car detail columns
ALTER TABLE Inventory
  ADD COLUMN seller_id    INT NULL,
  ADD COLUMN `year`       SMALLINT NULL,
  ADD COLUMN mileage      INT NULL,            -- km
  ADD COLUMN fuel         VARCHAR(20) NULL,    -- Petrol / Diesel / Hybrid / EV
  ADD COLUMN transmission VARCHAR(20) NULL,    -- Automatic / Manual
  ADD COLUMN seats        TINYINT NULL,
  ADD COLUMN engine_cc    INT NULL,
  ADD COLUMN fuel_economy DECIMAL(5,1) NULL,   -- km per litre
  ADD COLUMN color        VARCHAR(30) NULL,
  ADD COLUMN description  TEXT NULL;

CREATE INDEX idx_inventory_seller ON Inventory (seller_id);

-- 3) Buyer <-> seller conversations (one per buyer per car)
CREATE TABLE IF NOT EXISTS conversations (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  car_id      INT NOT NULL,
  buyer_id    INT NOT NULL,
  seller_id   INT NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_car_buyer (car_id, buyer_id),
  KEY idx_conv_buyer (buyer_id),
  KEY idx_conv_seller (seller_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender_id       INT NOT NULL,
  body            TEXT NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_msg_conv (conversation_id)
);

-- 4) Viewing / test-drive appointments inside a conversation
CREATE TABLE IF NOT EXISTS appointments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  proposed_by     INT NOT NULL,
  appointment_at  DATETIME NOT NULL,
  location        VARCHAR(255) NOT NULL,
  note            VARCHAR(500) NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending/accepted/declined/cancelled
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_appt_conv (conversation_id)
);
