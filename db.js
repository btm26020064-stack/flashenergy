const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'flashenergy.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'pcs',
      unit_cost REAL NOT NULL DEFAULT 0,
      selling_price REAL NOT NULL DEFAULT 0,
      min_threshold INTEGER NOT NULL DEFAULT 5,
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_code TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT NOT NULL,
      service_type TEXT NOT NULL,
      service_subtype TEXT,
      units_count INTEGER DEFAULT 1,
      preferred_date TEXT NOT NULL,
      preferred_time_slot TEXT NOT NULL,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      assigned_staff_id INTEGER REFERENCES staff(id),
      estimated_cost REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT UNIQUE NOT NULL,
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      customer_name TEXT NOT NULL,
      total_amount REAL NOT NULL DEFAULT 0,
      payment_status TEXT DEFAULT 'unpaid',
      payment_method TEXT DEFAULT 'Cash',
      items_json TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Default settings
  const checkSetting = db.prepare('SELECT count(*) as count FROM settings').get();
  if (checkSetting.count === 0) {
    const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('company_name', 'Flash Energy Sibu');
    insertSetting.run('company_phone', '018-959 6569');
    insertSetting.run('company_email', 'flashenergysibu@gmail.com');
    insertSetting.run('company_address', 'No. 38 & 40, Lot 2852 - 2853, Tingkat 1, Jalan Intan, 96000 Sibu, Sarawak');
    insertSetting.run('company_facebook', 'flashenergy');
    insertSetting.run('whatsapp_template', 'Hello {name}, kami dari Flash Energy Sibu mendapati anda telah membuat tempahan servis bagi {service} pada {date} ({time}). Lokasi: {address}. Sila maklumkan jika waktu ini sesuai untuk juruteknik kami.');
  }

  // Seed staff if empty
  const checkStaff = db.prepare('SELECT count(*) as count FROM staff').get();
  if (checkStaff.count === 0) {
    const insertStaff = db.prepare('INSERT INTO staff (name, phone, role, status) VALUES (?, ?, ?, ?)');
    insertStaff.run('Ah Hock (Lead Tech)', '019-812 3456', 'Air Conditioning Specialist', 'active');
    insertStaff.run('Danial Wong', '016-889 1234', 'Senior Electrician & Wireman', 'active');
    insertStaff.run('Kelvin Tiong', '013-822 9876', 'AC & Wiring Technician', 'active');
  }

  // Seed inventory if empty
  const checkInventory = db.prepare('SELECT count(*) as count FROM inventory').get();
  if (checkInventory.count === 0) {
    const insertInv = db.prepare('INSERT INTO inventory (item_code, name, category, quantity, unit, unit_cost, selling_price, min_threshold) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    insertInv.run('GAS-R32', 'R32 Refrigerant Gas Cylinder (10kg)', 'Refrigerant', 8, 'cylinder', 180.00, 260.00, 3);
    insertInv.run('GAS-R410A', 'R410A Refrigerant Gas Cylinder (11.3kg)', 'Refrigerant', 5, 'cylinder', 210.00, 290.00, 3);
    insertInv.run('CAP-35UF', 'Aircond Run Capacitor 35uF 450V', 'Capacitors', 24, 'pcs', 12.00, 35.00, 8);
    insertInv.run('CAP-45UF', 'Aircond Run Capacitor 45uF 450V', 'Capacitors', 15, 'pcs', 15.00, 45.00, 6);
    insertInv.run('CBL-2.5MM', 'Mega Pure Copper Cable 2.5mm² (100m roll)', 'Wiring & Cable', 6, 'roll', 145.00, 210.00, 2);
    insertInv.run('MCB-16A', 'Hager MCB 16A Single Pole Circuit Breaker', 'Electrical Parts', 30, 'pcs', 8.50, 22.00, 10);
    insertInv.run('PIPE-COPPER-38', 'Copper Pipe 3/8" + 1/4" Pair Coil (15m)', 'Pipes & Insulation', 10, 'roll', 95.00, 150.00, 3);
    insertInv.run('WASH-CHEM', 'Air Conditioning Coil Cleaner Chemical (5L)', 'Consumables', 7, 'bottle', 38.00, 65.00, 2);
  }

  // Seed initial orders for today, tomorrow, and future days if empty
  const checkOrders = db.prepare('SELECT count(*) as count FROM orders').get();
  if (checkOrders.count === 0) {
    const getLocalDateStr = (offsetDays = 0) => {
      const d = new Date();
      if (offsetDays !== 0) d.setDate(d.getDate() + offsetDays);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const todayStr = getLocalDateStr(0);
    const tomorrowStr = getLocalDateStr(1);
    const dayAfterStr = getLocalDateStr(2);

    const insertOrder = db.prepare(`
      INSERT INTO orders (
        order_code, customer_name, phone, email, address,
        service_type, service_subtype, units_count, preferred_date,
        preferred_time_slot, notes, status, assigned_staff_id, estimated_cost
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertOrder.run(
      'FE-202610-001',
      'Ling Sheng Wong',
      '019-876 5432',
      'ling.sibu@gmail.com',
      'Lorong Pahlawan 7, 96000 Sibu, Sarawak',
      'Air Conditioning Service & Installation',
      'Chemical Wash / Overhaul',
      2,
      todayStr,
      'Morning (9:00 AM - 12:00 PM)',
      'Ruang tamu dan bilik tidur utama aircond kurang sejuk dan ada bunyi bising.',
      'approved',
      1,
      240.00
    );

    insertOrder.run(
      'FE-202610-002',
      'Haji Mahmud bin Kassim',
      '013-888 2311',
      'mahmud.k@yahoo.com',
      'Jalan Kampung Datu, 96000 Sibu, Sarawak',
      'Electric Wiring',
      'Wiring Repair / Tripping Issue',
      1,
      todayStr,
      'Afternoon (1:00 PM - 5:00 PM)',
      'Trip bila buka suis dapur. Perlu periksa DB box & soket.',
      'pending',
      null,
      120.00
    );

    insertOrder.run(
      'FE-202610-003',
      'Jennifer Tiong',
      '016-555 7890',
      'jennifer_t@hotmail.com',
      'Lorong Ulu Sungai Merah 18, 96000 Sibu, Sarawak',
      'Air Conditioning Service & Installation',
      'Normal Servicing & Gas Refill',
      3,
      tomorrowStr,
      'Morning (9:00 AM - 12:00 PM)',
      'Servis berkala 3 unit aircond Daikin 1.0HP & 1.5HP.',
      'pending',
      null,
      210.00
    );

    insertOrder.run(
      'FE-202610-004',
      'David Lau',
      '018-992 4321',
      'davidlau99@gmail.com',
      'Jalan Pedada, Pekan Sibu, 96000 Sibu, Sarawak',
      'Electric Wiring',
      'Power Point & Lighting Installation',
      4,
      dayAfterStr,
      'Afternoon (1:00 PM - 5:00 PM)',
      'Pasang 4 biji lampu siling LED baru dan tambah 2 soket plug di kedai.',
      'pending',
      null,
      180.00
    );

    // Seed one invoice
    const insertInvoice = db.prepare(`
      INSERT INTO invoices (invoice_no, order_id, customer_name, total_amount, payment_status, payment_method, items_json, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertInvoice.run(
      'INV-202610-001',
      1,
      'Ling Sheng Wong',
      240.00,
      'paid',
      'Online Banking / DuitNow',
      JSON.stringify([
        { description: 'Chemical Wash & Overhaul (1.5HP Daikin)', qty: 1, unit_price: 130.00, total: 130.00 },
        { description: 'Chemical Wash (1.0HP Panasonic)', qty: 1, unit_price: 110.00, total: 110.00 }
      ]),
      'Terima kasih menggunakan khidmat Flash Energy Sibu.'
    );
  }
}

initDb();

module.exports = db;
