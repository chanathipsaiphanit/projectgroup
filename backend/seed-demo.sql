-- Optional demo data so the AI advisor / compare / fair-price model
-- have enough cars to learn from (the price model needs >= 8 cars
-- that have year + mileage filled in). Safe to skip.
INSERT INTO Inventory
  (name, model, type, price, image, stock, `year`, mileage, fuel, transmission, seats, engine_cc, fuel_economy, color, description)
VALUES
  ('Honda Civic FE',        'EL+',          'Sedan',      929000,  '', 3, 2023, 18000,  'Petrol', 'Automatic', 5, 1500, 16.5, 'White',  'One owner, full service history.'),
  ('Toyota Yaris Ativ',     'Premium',      'Sedan',      549000,  '', 4, 2022, 32000,  'Petrol', 'Automatic', 5, 1200, 20.0, 'Silver', 'Economical city sedan.'),
  ('Toyota Corolla Cross',  'HEV Premium',  'SUV',       1099000,  '', 2, 2023, 21000,  'Hybrid', 'Automatic', 5, 1800, 23.3, 'Grey',   'Hybrid SUV, very low fuel cost.'),
  ('Honda HR-V',            'e:HEV EL',     'SUV',        999000,  '', 1, 2022, 40000,  'Hybrid', 'Automatic', 5, 1500, 25.6, 'Red',    'Sunroof, Honda Sensing.'),
  ('Toyota Fortuner',       'Legender 2.8', 'SUV',       1459000,  '', 2, 2021, 65000,  'Diesel', 'Automatic', 7, 2800, 12.8, 'Black',  '7 seats, 4x4, great for family trips.'),
  ('Isuzu D-Max',           'V-Cross 3.0',  'Pickup',     899000,  '', 3, 2022, 48000,  'Diesel', 'Automatic', 5, 3000, 13.5, 'White',  'Double cab 4x4.'),
  ('Toyota Hilux Revo',     'Rocco',        'Pickup',     859000,  '', 2, 2020, 89000,  'Diesel', 'Manual',    5, 2400, 14.2, 'Silver', 'Tough workhorse.'),
  ('Mazda 2',               'Sports 1.3 SP','Hatchback',  479000,  '', 5, 2021, 52000,  'Petrol', 'Automatic', 5, 1300, 20.4, 'Blue',   'Easy to park, fun to drive.'),
  ('Honda City Hatchback',  'RS',           'Hatchback',  569000,  '', 1, 2023, 15000,  'Petrol', 'Automatic', 5, 1000, 23.3, 'Orange', 'Turbo 1.0, like new.'),
  ('BYD Atto 3',            'Extended',     'SUV',        859000,  '', 2, 2023, 22000,  'EV',     'Automatic', 5, NULL,  NULL, 'White',  '480 km range, home charger included.'),
  ('Ford Mustang',          '2.3 EcoBoost', 'Sports Car',2890000,  '', 1, 2020, 30000,  'Petrol', 'Automatic', 4, 2300,  9.8, 'Yellow', 'Head-turner, garage kept.'),
  ('Mazda MX-5',            'RF 2.0',       'Sports Car',1790000,  '', 1, 2019, 41000,  'Petrol', 'Manual',    2, 2000, 14.1, 'Red',    'Retractable hardtop.'),
  ('Mitsubishi Xpander',    'Cross',        'SUV',        749000,  '', 3, 2022, 38000,  'Petrol', 'Automatic', 7, 1500, 15.2, 'Brown',  'Affordable 7-seater.');
