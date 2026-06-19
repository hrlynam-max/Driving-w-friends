-- Overdrive — starter vehicle catalog (Make -> Model -> Generation).
-- Small but real cross-scene set so the RideSelector has something to drill into.
-- Run after 0001_init.sql.  `supabase db reset` applies migrations then this seed.

INSERT INTO makes (name, country) VALUES
  ('BMW', 'Germany'),
  ('Mazda', 'Japan'),
  ('Nissan', 'Japan'),
  ('Toyota', 'Japan'),
  ('Honda', 'Japan'),
  ('Subaru', 'Japan'),
  ('Chevrolet', 'USA'),
  ('Ford', 'USA'),
  ('Volkswagen', 'Germany'),
  ('Audi', 'Germany')
ON CONFLICT (name) DO NOTHING;

-- Models resolve their make by name.
INSERT INTO models (make_id, name)
SELECT m.id, v.model
FROM (VALUES
  ('BMW', '3-Series'),
  ('BMW', '4-Series'),
  ('BMW', 'M2'),
  ('Mazda', 'RX-7'),
  ('Mazda', 'MX-5 Miata'),
  ('Nissan', 'Skyline GT-R'),
  ('Nissan', '350Z'),
  ('Nissan', 'Silvia'),
  ('Toyota', 'Supra'),
  ('Toyota', 'GR86'),
  ('Honda', 'Civic'),
  ('Honda', 'S2000'),
  ('Subaru', 'WRX STI'),
  ('Chevrolet', 'Corvette'),
  ('Chevrolet', 'Camaro'),
  ('Ford', 'Mustang'),
  ('Volkswagen', 'Golf GTI'),
  ('Audi', 'RS3')
) AS v(make, model)
JOIN makes m ON m.name = v.make
ON CONFLICT (make_id, name) DO NOTHING;

INSERT INTO generations (model_id, name, chassis_code, year_start, year_end, body_style)
SELECT md.id, g.gen, g.chassis, g.y_start, g.y_end, g.body
FROM (VALUES
  ('BMW', '3-Series', 'E46 M3', 'E46', 2000, 2006, 'Coupe'),
  ('BMW', '3-Series', 'E90 335i', 'E90', 2006, 2011, 'Sedan'),
  ('BMW', '4-Series', 'G82 M4', 'G82', 2021, NULL, 'Coupe'),
  ('BMW', 'M2', 'G87', 'G87', 2023, NULL, 'Coupe'),
  ('Mazda', 'RX-7', 'FD', 'FD3S', 1992, 2002, 'Coupe'),
  ('Mazda', 'RX-7', 'FC', 'FC3S', 1985, 1992, 'Coupe'),
  ('Mazda', 'MX-5 Miata', 'NA', 'NA', 1989, 1997, 'Roadster'),
  ('Mazda', 'MX-5 Miata', 'ND', 'ND', 2015, NULL, 'Roadster'),
  ('Nissan', 'Skyline GT-R', 'R34', 'BNR34', 1999, 2002, 'Coupe'),
  ('Nissan', 'Skyline GT-R', 'R32', 'BNR32', 1989, 1994, 'Coupe'),
  ('Nissan', '350Z', 'Z33', 'Z33', 2002, 2009, 'Coupe'),
  ('Nissan', 'Silvia', 'S15', 'S15', 1999, 2002, 'Coupe'),
  ('Toyota', 'Supra', 'A80', 'JZA80', 1993, 2002, 'Coupe'),
  ('Toyota', 'Supra', 'A90', 'A90', 2019, NULL, 'Coupe'),
  ('Toyota', 'GR86', 'ZN8', 'ZN8', 2021, NULL, 'Coupe'),
  ('Honda', 'Civic', 'EK9 Type R', 'EK9', 1997, 2000, 'Hatch'),
  ('Honda', 'Civic', 'FL5 Type R', 'FL5', 2023, NULL, 'Hatch'),
  ('Honda', 'S2000', 'AP1', 'AP1', 1999, 2003, 'Roadster'),
  ('Subaru', 'WRX STI', 'GD', 'GD', 2004, 2007, 'Sedan'),
  ('Subaru', 'WRX STI', 'GR', 'GR', 2008, 2014, 'Hatch'),
  ('Chevrolet', 'Corvette', 'C8', 'C8', 2020, NULL, 'Coupe'),
  ('Chevrolet', 'Camaro', '6th Gen SS', 'A1XX', 2016, 2024, 'Coupe'),
  ('Ford', 'Mustang', 'S550 GT', 'S550', 2015, 2023, 'Coupe'),
  ('Volkswagen', 'Golf GTI', 'Mk7', 'Mk7', 2013, 2020, 'Hatch'),
  ('Audi', 'RS3', '8V', '8V', 2015, 2020, 'Sedan')
) AS g(make, model, gen, chassis, y_start, y_end, body)
JOIN makes mk ON mk.name = g.make
JOIN models md ON md.make_id = mk.id AND md.name = g.model
ON CONFLICT (model_id, name) DO NOTHING;
