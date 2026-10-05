const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper to format Malaysian phone numbers for wa.me URL
function formatPhoneForWhatsApp(phone) {
  if (!phone) return '';
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) {
    clean = '60' + clean.slice(1);
  } else if (!clean.startsWith('60') && clean.length > 8) {
    clean = '60' + clean;
  }
  return clean;
}

// Helper to generate order code
function generateOrderCode() {
  const date = new Date();
  const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `FE-${yearMonth}-${randomSuffix}`;
}

// Helper to generate invoice number
function generateInvoiceNo() {
  const date = new Date();
  const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return `INV-${yearMonth}-${randomSuffix}`;
}

// Helper to format date in local Malaysian time (YYYY-MM-DD)
function getLocalDateStr(offsetDays = 0) {
  const d = new Date();
  if (offsetDays !== 0) d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ---------------- PUBLIC API ---------------- //

// Get company info
app.get('/api/company-info', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Customer submits order
app.post('/api/orders', (req, res) => {
  try {
    const {
      customer_name,
      phone,
      email,
      address,
      service_type,
      service_subtype,
      units_count,
      preferred_date,
      preferred_time_slot,
      notes
    } = req.body;

    if (!customer_name || !phone || !address || !service_type || !preferred_date) {
      return res.status(400).json({ success: false, message: 'Nama, No. Telefon, Alamat, Jenis Servis dan Tarikh pilihan adalah wajib.' });
    }

    const order_code = generateOrderCode();
    const stmt = db.prepare(`
      INSERT INTO orders (
        order_code, customer_name, phone, email, address,
        service_type, service_subtype, units_count, preferred_date,
        preferred_time_slot, notes, status, estimated_cost
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)
    `);

    const result = stmt.run(
      order_code,
      customer_name.trim(),
      phone.trim(),
      email ? email.trim() : null,
      address.trim(),
      service_type,
      service_subtype || '',
      parseInt(units_count, 10) || 1,
      preferred_date,
      preferred_time_slot || 'Morning (9:00 AM - 12:00 PM)',
      notes || ''
    );

    const companyPhone = db.prepare("SELECT value FROM settings WHERE key = 'company_phone'").get()?.value || '018-959 6569';
    const waCompany = formatPhoneForWhatsApp(companyPhone);
    const customerMsg = encodeURIComponent(`Salam Flash Energy Sibu, saya ${customer_name} telah membuat tempahan #${order_code} untuk servis ${service_type} (${service_subtype || ''}) pada tarikh ${preferred_date}.`);
    const customerWaUrl = `https://wa.me/${waCompany}?text=${customerMsg}`;

    res.status(201).json({
      success: true,
      message: 'Tempahan anda berjaya dihantar! Pihak Flash Energy Sibu akan menghubungi anda melalui WhatsApp untuk pengesahan.',
      order: {
        id: result.lastInsertRowid,
        order_code,
        customer_name,
        phone,
        preferred_date,
        service_type,
        customerWaUrl
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Customer tracking
app.get('/api/orders/track', (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ success: false, message: 'Masukkan No. Tempahan atau No. Telefon' });
    }

    const cleanQuery = query.trim();
    const orders = db.prepare(`
      SELECT o.*, s.name as staff_name, s.phone as staff_phone
      FROM orders o
      LEFT JOIN staff s ON o.assigned_staff_id = s.id
      WHERE o.order_code LIKE ? OR o.phone LIKE ?
      ORDER BY o.id DESC
      LIMIT 10
    `).all(`%${cleanQuery}%`, `%${cleanQuery.replace(/[^0-9]/g, '')}%`);

    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------- ADMIN & ERP API ---------------- //

// Metrics dashboard
app.get('/api/admin/metrics', (req, res) => {
  try {
    const today = getLocalDateStr(0);
    const tomorrow = getLocalDateStr(1);

    const todayCount = db.prepare('SELECT count(*) as count FROM orders WHERE preferred_date = ?').get(today).count;
    const tomorrowCount = db.prepare('SELECT count(*) as count FROM orders WHERE preferred_date = ?').get(tomorrow).count;
    const upcomingCount = db.prepare('SELECT count(*) as count FROM orders WHERE preferred_date > ?').get(tomorrow).count;
    const totalCount = db.prepare('SELECT count(*) as count FROM orders').get().count;

    const pendingCount = db.prepare("SELECT count(*) as count FROM orders WHERE status = 'pending'").get().count;
    const approvedCount = db.prepare("SELECT count(*) as count FROM orders WHERE status = 'approved'").get().count;
    const inProgressCount = db.prepare("SELECT count(*) as count FROM orders WHERE status = 'in_progress'").get().count;
    const completedCount = db.prepare("SELECT count(*) as count FROM orders WHERE status = 'completed'").get().count;
    const rejectedCount = db.prepare("SELECT count(*) as count FROM orders WHERE status = 'rejected'").get().count;

    const totalRevenue = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as revenue FROM invoices WHERE payment_status = 'paid'").get().revenue;
    const lowStockCount = db.prepare('SELECT count(*) as count FROM inventory WHERE quantity <= min_threshold').get().count;

    res.json({
      success: true,
      data: {
        today,
        tomorrow,
        orders_today: todayCount,
        orders_tomorrow: tomorrowCount,
        orders_upcoming: upcomingCount,
        orders_total: totalCount,
        status: {
          pending: pendingCount,
          approved: approvedCount,
          in_progress: inProgressCount,
          completed: completedCount,
          rejected: rejectedCount
        },
        financials: {
          total_revenue: totalRevenue
        },
        inventory_alerts: lowStockCount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin get orders list with filters
app.get('/api/admin/orders', (req, res) => {
  try {
    const { date_filter, status, search } = req.query;
    const today = getLocalDateStr(0);
    const tomorrow = getLocalDateStr(1);

    let query = `
      SELECT o.*, s.name as staff_name, s.phone as staff_phone,
             inv.id as invoice_id, inv.invoice_no, inv.payment_status, inv.total_amount as invoice_amount
      FROM orders o
      LEFT JOIN staff s ON o.assigned_staff_id = s.id
      LEFT JOIN invoices inv ON o.id = inv.order_id
      WHERE 1=1
    `;
    const params = [];

    if (date_filter === 'today') {
      query += ' AND o.preferred_date = ?';
      params.push(today);
    } else if (date_filter === 'tomorrow') {
      query += ' AND o.preferred_date = ?';
      params.push(tomorrow);
    } else if (date_filter === 'upcoming') {
      query += ' AND o.preferred_date > ?';
      params.push(tomorrow);
    } else if (date_filter === 'past') {
      query += ' AND o.preferred_date < ?';
      params.push(today);
    }

    if (status && status !== 'all') {
      query += ' AND o.status = ?';
      params.push(status);
    }

    if (search && search.trim() !== '') {
      const term = `%${search.trim()}%`;
      query += ' AND (o.customer_name LIKE ? OR o.phone LIKE ? OR o.order_code LIKE ? OR o.address LIKE ?)';
      params.push(term, term, term, term);
    }

    query += ' ORDER BY o.preferred_date ASC, o.id DESC';

    const orders = db.prepare(query).all(...params);
    res.json({ success: true, count: orders.length, orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update order status & details (Approve, Reject, In Progress, Completed)
app.patch('/api/admin/orders/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status, assigned_staff_id, estimated_cost, notes } = req.body;

    const current = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!current) {
      return res.status(404).json({ success: false, message: 'Order tidak dijumpai.' });
    }

    const newStatus = status || current.status;
    const newStaff = assigned_staff_id !== undefined ? (assigned_staff_id || null) : current.assigned_staff_id;
    const newCost = estimated_cost !== undefined ? estimated_cost : current.estimated_cost;
    const newNotes = notes !== undefined ? notes : current.notes;

    db.prepare(`
      UPDATE orders
      SET status = ?, assigned_staff_id = ?, estimated_cost = ?, notes = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(newStatus, newStaff, newCost, newNotes, id);

    const updated = db.prepare(`
      SELECT o.*, s.name as staff_name, s.phone as staff_phone
      FROM orders o
      LEFT JOIN staff s ON o.assigned_staff_id = s.id
      WHERE o.id = ?
    `).get(id);

    res.json({ success: true, message: `Status order berjaya dikemaskini kepada: ${newStatus}`, order: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete order
app.delete('/api/admin/orders/:id', (req, res) => {
  try {
    const { id } = req.params;
    const current = db.prepare('SELECT order_code FROM orders WHERE id = ?').get(id);
    if (!current) {
      return res.status(404).json({ success: false, message: 'Order tidak dijumpai.' });
    }

    db.prepare('DELETE FROM invoices WHERE order_id = ?').run(id);
    db.prepare('DELETE FROM orders WHERE id = ?').run(id);

    res.json({ success: true, message: `Order #${current.order_code} berjaya dipadam.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// WhatsApp generator for order
app.get('/api/admin/orders/:id/whatsapp', (req, res) => {
  try {
    const { id } = req.params;
    const order = db.prepare(`
      SELECT o.*, s.name as staff_name, s.phone as staff_phone
      FROM orders o
      LEFT JOIN staff s ON o.assigned_staff_id = s.id
      WHERE o.id = ?
    `).get(id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order tidak dijumpai.' });
    }

    const templateSetting = db.prepare("SELECT value FROM settings WHERE key = 'whatsapp_template'").get();
    let template = templateSetting?.value || 'Hello {name}, kami dari Flash Energy Sibu telah mendapati anda ingin servis/install {service} pada {date} ({time}). Lokasi: {address}. Sila maklumkan jika waktu ini sesuai.';

    const formattedPhone = formatPhoneForWhatsApp(order.phone);
    const serviceFull = `${order.service_type}${order.service_subtype ? ' - ' + order.service_subtype : ''}`;

    let message = template
      .replace(/{name}/g, order.customer_name)
      .replace(/{service}/g, serviceFull)
      .replace(/{date}/g, order.preferred_date)
      .replace(/{time}/g, order.preferred_time_slot)
      .replace(/{address}/g, order.address)
      .replace(/{order_code}/g, order.order_code)
      .replace(/{estimated_cost}/g, order.estimated_cost ? `RM ${parseFloat(order.estimated_cost).toFixed(2)}` : 'akan ditentukan');

    if (order.staff_name) {
      message += `\nJuruteknik bertugas: ${order.staff_name}`;
    }

    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;

    res.json({
      success: true,
      customer_name: order.customer_name,
      phone: order.phone,
      formatted_phone: formattedPhone,
      message,
      whatsapp_url: waUrl
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------- ERP: STAFF & TECHNICIANS ---------------- //

app.get('/api/admin/staff', (req, res) => {
  try {
    const staff = db.prepare(`
      SELECT s.*, 
        (SELECT count(*) FROM orders o WHERE o.assigned_staff_id = s.id AND o.status IN ('approved', 'in_progress')) as active_jobs
      FROM staff s
      ORDER BY s.id ASC
    `).all();
    res.json({ success: true, staff });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/staff', (req, res) => {
  try {
    const { name, phone, role, status } = req.body;
    if (!name || !role) {
      return res.status(400).json({ success: false, message: 'Nama dan Jawatan adalah wajib.' });
    }
    const stmt = db.prepare('INSERT INTO staff (name, phone, role, status) VALUES (?, ?, ?, ?)');
    const result = stmt.run(name.trim(), phone || '', role.trim(), status || 'active');
    res.status(201).json({ success: true, message: 'Staf berjaya ditambah.', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/admin/staff/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, role, status } = req.body;
    db.prepare('UPDATE staff SET name = COALESCE(?, name), phone = COALESCE(?, phone), role = COALESCE(?, role), status = COALESCE(?, status) WHERE id = ?')
      .run(name, phone, role, status, id);
    res.json({ success: true, message: 'Maklumat staf berjaya dikemaskini.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/admin/staff/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('UPDATE orders SET assigned_staff_id = NULL WHERE assigned_staff_id = ?').run(id);
    db.prepare('DELETE FROM staff WHERE id = ?').run(id);
    res.json({ success: true, message: 'Staf berjaya dipadam.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------- ERP: INVENTORY ---------------- //

app.get('/api/admin/inventory', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM inventory ORDER BY category ASC, name ASC').all();
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/inventory', (req, res) => {
  try {
    const { item_code, name, category, quantity, unit, unit_cost, selling_price, min_threshold } = req.body;
    if (!name || !item_code) {
      return res.status(400).json({ success: false, message: 'Kod Item dan Nama adalah wajib.' });
    }
    const stmt = db.prepare(`
      INSERT INTO inventory (item_code, name, category, quantity, unit, unit_cost, selling_price, min_threshold)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      item_code.trim().toUpperCase(),
      name.trim(),
      category || 'General',
      parseInt(quantity, 10) || 0,
      unit || 'pcs',
      parseFloat(unit_cost) || 0,
      parseFloat(selling_price) || 0,
      parseInt(min_threshold, 10) || 5
    );
    res.status(201).json({ success: true, message: 'Barang inventori berjaya ditambah.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/admin/inventory/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, unit_cost, selling_price, min_threshold, adjust_qty } = req.body;

    if (adjust_qty !== undefined) {
      db.prepare("UPDATE inventory SET quantity = quantity + ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
        .run(parseInt(adjust_qty, 10), id);
    } else {
      db.prepare(`
        UPDATE inventory 
        SET quantity = COALESCE(?, quantity),
            unit_cost = COALESCE(?, unit_cost),
            selling_price = COALESCE(?, selling_price),
            min_threshold = COALESCE(?, min_threshold),
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(quantity, unit_cost, selling_price, min_threshold, id);
    }

    res.json({ success: true, message: 'Inventori dikemaskini.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/admin/inventory/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM inventory WHERE id = ?').run(id);
    res.json({ success: true, message: 'Barang inventori berjaya dipadam.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------- ERP: INVOICES & BILLING ---------------- //

app.get('/api/admin/invoices', (req, res) => {
  try {
    const invoices = db.prepare(`
      SELECT inv.*, o.order_code, o.service_type, o.address, o.phone, o.email
      FROM invoices inv
      JOIN orders o ON inv.order_id = o.id
      ORDER BY inv.id DESC
    `).all();
    res.json({ success: true, invoices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/invoices', (req, res) => {
  try {
    const { order_id, customer_name, total_amount, payment_status, payment_method, items, notes } = req.body;

    if (!order_id) {
      return res.status(400).json({ success: false, message: 'Order ID diperlukan.' });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order tidak wujud.' });
    }

    const invoice_no = generateInvoiceNo();
    const itemsJson = JSON.stringify(items || [
      { description: `${order.service_type} - ${order.service_subtype || 'Servis'}`, qty: order.units_count, unit_price: parseFloat(total_amount) || 0, total: parseFloat(total_amount) || 0 }
    ]);

    const stmt = db.prepare(`
      INSERT INTO invoices (invoice_no, order_id, customer_name, total_amount, payment_status, payment_method, items_json, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      invoice_no,
      order_id,
      customer_name || order.customer_name,
      parseFloat(total_amount) || 0,
      payment_status || 'unpaid',
      payment_method || 'Cash',
      itemsJson,
      notes || 'Terima kasih atas sokongan anda kepada Flash Energy Sibu.'
    );

    // If paid, update order estimated_cost
    db.prepare('UPDATE orders SET estimated_cost = ? WHERE id = ?').run(parseFloat(total_amount) || 0, order_id);

    res.status(201).json({ success: true, message: 'Invois berjaya dicipta!', invoice_no });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/admin/invoices/:id/payment', (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status, payment_method } = req.body;
    db.prepare('UPDATE invoices SET payment_status = ?, payment_method = COALESCE(?, payment_method) WHERE id = ?')
      .run(payment_status, payment_method, id);
    res.json({ success: true, message: `Status pembayaran dikemaskini: ${payment_status}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Single invoice print/details
app.get('/api/admin/invoices/:id', (req, res) => {
  try {
    const { id } = req.params;
    const invoice = db.prepare(`
      SELECT inv.*, o.order_code, o.service_type, o.service_subtype, o.address, o.phone, o.email, o.preferred_date
      FROM invoices inv
      JOIN orders o ON inv.order_id = o.id
      WHERE inv.id = ?
    `).get(id);

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invois tidak dijumpai.' });
    }

    const settingsRows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    settingsRows.forEach(r => { settings[r.key] = r.value; });

    res.json({ success: true, invoice, company: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------- SETTINGS & TEMPLATES ---------------- //

app.get('/api/admin/settings', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/settings', (req, res) => {
  try {
    const settings = req.body;
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    const updateMany = db.transaction((obj) => {
      for (const [key, value] of Object.entries(obj)) {
        stmt.run(key, String(value));
      }
    });
    updateMany(settings);
    res.json({ success: true, message: 'Tetapan berjaya disimpan.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Navigation shortcuts
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`Flash Energy Sibu server running on http://localhost:${PORT}`);
});
