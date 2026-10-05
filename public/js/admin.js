let currentDateFilter = 'all';
let searchTimeout = null;
let currentStaffList = [];

// Initialize Admin Portal
document.addEventListener('DOMContentLoaded', () => {
  loadMetrics();
  loadOrders();
  loadStaff();
  loadInventory();
  loadInvoices();
  loadSettings();
  
  // Refresh metrics every 60s
  setInterval(loadMetrics, 60000);
});

// Tab navigation
function switchTab(tab) {
  const sections = ['orders', 'staff', 'inventory', 'invoices', 'settings'];
  sections.forEach(s => {
    const el = document.getElementById(`section-${s}`);
    const btn = document.getElementById(`tab-${s}`);
    if (s === tab) {
      el.classList.remove('hidden');
      btn.classList.add('border-sky-600', 'text-sky-600');
      btn.classList.remove('border-transparent', 'text-slate-500');
    } else {
      el.classList.add('hidden');
      btn.classList.remove('border-sky-600', 'text-sky-600');
      btn.classList.add('border-transparent', 'text-slate-500');
    }
  });

  if (window.lucide) lucide.createIcons();
}

// Set Date Filter for Orders
function setDateFilter(filter) {
  currentDateFilter = filter;
  const buttons = ['all', 'today', 'tomorrow', 'upcoming', 'past'];
  buttons.forEach(b => {
    const btn = document.getElementById(`df-${b}`);
    if (b === filter) {
      btn.className = 'date-filter-btn px-3 py-1.5 rounded-lg bg-sky-600 text-white transition flex items-center gap-1';
    } else {
      btn.className = 'date-filter-btn px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1';
    }
  });
  loadOrders();
}

function debounceSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadOrders();
  }, 300);
}

// ---------------- 1. METRICS & COUNTERS ---------------- //
async function loadMetrics() {
  try {
    const res = await fetch('/api/admin/metrics');
    const data = await res.json();
    if (!data.success) return;

    const m = data.data;
    document.getElementById('metric_today').innerText = m.orders_today;
    document.getElementById('metric_tomorrow').innerText = m.orders_tomorrow;
    document.getElementById('metric_upcoming').innerText = m.orders_upcoming;
    document.getElementById('metric_pending').innerText = m.status.pending;

    document.getElementById('df-today-badge').innerText = m.orders_today;
    document.getElementById('df-tomorrow-badge').innerText = m.orders_tomorrow;
    document.getElementById('df-upcoming-badge').innerText = m.orders_upcoming;

    // Inventory alert badge
    const invBadge = document.getElementById('badge-inv-alert');
    if (m.inventory_alerts > 0) {
      invBadge.classList.remove('hidden');
      invBadge.innerText = `${m.inventory_alerts} Rendah`;
    } else {
      invBadge.classList.add('hidden');
    }
  } catch (err) {
    console.error('Error loading metrics:', err);
  }
}

// ---------------- 2. ORDERS MANAGEMENT ---------------- //
async function loadOrders() {
  const tbody = document.getElementById('ordersTableBody');
  const status = document.getElementById('statusFilter').value;
  const search = document.getElementById('orderSearch').value.trim();

  let url = `/api/admin/orders?date_filter=${currentDateFilter}`;
  if (status && status !== 'all') url += `&status=${status}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.success) return;

    document.getElementById('badge-orders-count').innerText = data.count;

    if (data.orders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-10 text-slate-400">
            <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
            Tiada rekod tempahan untuk kriteria pilihan ini.
          </td>
        </tr>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    const statusBadgeMap = {
      'pending': '<span class="fe-badge-pending px-2.5 py-1 rounded-full font-bold text-[11px] inline-flex items-center gap-1">Menunggu</span>',
      'approved': '<span class="fe-badge-approved px-2.5 py-1 rounded-full font-bold text-[11px] inline-flex items-center gap-1">Diluluskan</span>',
      'in_progress': '<span class="fe-badge-in_progress px-2.5 py-1 rounded-full font-bold text-[11px] inline-flex items-center gap-1">Sedang Servis</span>',
      'completed': '<span class="fe-badge-completed px-2.5 py-1 rounded-full font-bold text-[11px] inline-flex items-center gap-1">Selesai</span>',
      'rejected': '<span class="fe-badge-rejected px-2.5 py-1 rounded-full font-bold text-[11px] inline-flex items-center gap-1">Ditolak</span>'
    };

    tbody.innerHTML = data.orders.map(o => {
      const badge = statusBadgeMap[o.status] || `<span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">${o.status}</span>`;
      const estCost = o.estimated_cost ? `RM ${parseFloat(o.estimated_cost).toFixed(2)}` : '<span class="text-slate-400 italic">Belum ditetapkan</span>';

      return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
          <td class="py-3 px-4 font-mono">
            <div class="font-bold text-sky-700">${o.order_code}</div>
            <div class="text-[11px] text-slate-700 font-semibold mt-0.5">Tarikh: ${o.preferred_date}</div>
            <div class="text-[10px] text-slate-500">${o.preferred_time_slot}</div>
          </td>

          <td class="py-3 px-4">
            <div class="font-bold text-slate-900">${escapeHtml(o.customer_name)}</div>
            <div class="text-slate-600 font-mono text-[11px]">Tel: ${escapeHtml(o.phone)}</div>
            ${o.email ? `<div class="text-slate-400 text-[10px]">${escapeHtml(o.email)}</div>` : ''}
          </td>

          <td class="py-3 px-4">
            <div class="font-semibold text-slate-800">${escapeHtml(o.service_type)}</div>
            <div class="text-sky-700 text-[11px] font-medium">${escapeHtml(o.service_subtype || '-')}</div>
            <div class="text-slate-500 text-[10px] mt-0.5">Unit: <span class="font-bold">${o.units_count}</span></div>
          </td>

          <td class="py-3 px-4 max-w-xs">
            <div class="text-slate-700 line-clamp-2" title="${escapeHtml(o.address)}">${escapeHtml(o.address)}</div>
            ${o.notes ? `<div class="text-slate-400 italic text-[10px] mt-1 line-clamp-1" title="${escapeHtml(o.notes)}">Nota: "${escapeHtml(o.notes)}"</div>` : ''}
          </td>

          <td class="py-3 px-4">
            ${o.staff_name ? `
              <div class="font-semibold text-slate-800 flex items-center gap-1">
                <span>Juruteknik: ${escapeHtml(o.staff_name)}</span>
              </div>
            ` : '<span class="text-amber-600 text-[11px] font-medium">Belum ditugaskan</span>'}
            <div class="text-[11px] text-slate-500 mt-1">Kos: ${estCost}</div>
          </td>

          <td class="py-3 px-4">
            ${badge}
            ${o.invoice_no ? `
              <div class="mt-1.5">
                <span class="inline-block text-[10px] font-mono px-1.5 py-0.5 rounded ${o.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800 font-bold' : 'bg-amber-100 text-amber-800'}">
                  ${o.invoice_no} (${o.payment_status === 'paid' ? 'PAID' : 'UNPAID'})
                </span>
              </div>
            ` : ''}
          </td>

          <td class="py-3 px-4 text-center">
            <div class="flex items-center justify-center gap-1 flex-wrap">
              <!-- WhatsApp Button -->
              <button onclick="triggerWhatsAppModal(${o.id})" class="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 shadow-sm" title="Hubungi Pelanggan di WhatsApp">
                <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                <span>WhatsApp</span>
              </button>

              <!-- Approve Button -->
              ${o.status === 'pending' ? `
                <button onclick="openApproveModal(${o.id}, '${escapeHtml(o.order_code)}', '${escapeHtml(o.customer_name)}', ${o.estimated_cost || 0})" class="bg-sky-600 hover:bg-sky-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1" title="Luluskan Tempahan">
                  <i data-lucide="check" class="w-3.5 h-3.5"></i>
                  <span>Lulus</span>
                </button>
              ` : ''}

              <!-- In Progress Toggle -->
              ${o.status === 'approved' ? `
                <button onclick="updateOrderStatus(${o.id}, 'in_progress')" class="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1.5 rounded-lg text-xs font-semibold transition" title="Tukar ke Sedang Servis">
                  <span>Mula Servis</span>
                </button>
              ` : ''}

              <!-- Completed Toggle -->
              ${o.status === 'in_progress' ? `
                <button onclick="updateOrderStatus(${o.id}, 'completed')" class="bg-emerald-700 hover:bg-emerald-800 text-white px-2 py-1.5 rounded-lg text-xs font-semibold transition" title="Tandakan Selesai">
                  <span>Selesai</span>
                </button>
              ` : ''}

              <!-- Invoice Button -->
              ${!o.invoice_no ? `
                <button onclick="openCreateInvoiceModal(${o.id}, '${escapeHtml(o.order_code)}', '${escapeHtml(o.customer_name)}', '${escapeHtml(o.service_type)}', ${o.estimated_cost || 0})" class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1.5 rounded-lg text-xs font-medium transition" title="Jana Invois">
                  <i data-lucide="receipt" class="w-3.5 h-3.5"></i>
                </button>
              ` : ''}

              <!-- Reject Button -->
              ${o.status !== 'rejected' && o.status !== 'completed' ? `
                <button onclick="updateOrderStatus(${o.id}, 'rejected')" class="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition" title="Tolak / Batal">
                  <i data-lucide="x-circle" class="w-4 h-4"></i>
                </button>
              ` : ''}

              <!-- Delete Button -->
              <button onclick="deleteOrder(${o.id}, '${escapeHtml(o.order_code)}')" class="text-slate-400 hover:text-rose-600 hover:bg-slate-100 p-1.5 rounded-lg transition" title="Padam Tempahan">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('Error loading orders:', err);
  }
}

// ---------------- WHATSAPP MODAL & TRIGGER ---------------- //
async function triggerWhatsAppModal(orderId) {
  try {
    const res = await fetch(`/api/admin/orders/${orderId}/whatsapp`);
    const data = await res.json();
    if (!data.success) {
      alert(data.message || 'Ralat menyediakan pautan WhatsApp.');
      return;
    }

    document.getElementById('waModal_name').innerText = data.customer_name;
    document.getElementById('waModal_phone').innerText = data.phone;
    
    const textArea = document.getElementById('waModal_text');
    textArea.value = data.message;

    const openLink = document.getElementById('waModal_open_link');
    openLink.href = data.whatsapp_url;

    // Dynamically update link if admin edits the message in modal
    textArea.oninput = () => {
      openLink.href = `https://wa.me/${data.formatted_phone}?text=${encodeURIComponent(textArea.value)}`;
    };

    document.getElementById('waModal').classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    alert('Ralat rangkaian semasa menjana mesej WhatsApp.');
  }
}

function closeWaModal() {
  document.getElementById('waModal').classList.add('hidden');
}

function copyWaText() {
  const text = document.getElementById('waModal_text').value;
  navigator.clipboard.writeText(text).then(() => {
    alert('Mesej WhatsApp disalin ke papan keratan (clipboard)!');
  });
}

// ---------------- APPROVE / UPDATE / DELETE ORDERS ---------------- //
function openApproveModal(orderId, orderCode, customerName, estCost) {
  document.getElementById('app_order_id').value = orderId;
  document.getElementById('app_order_code').innerText = orderCode;
  document.getElementById('app_order_cust').innerText = customerName;
  document.getElementById('app_estimated_cost').value = estCost > 0 ? estCost : '';

  // Populate staff dropdown
  const select = document.getElementById('app_staff_id');
  select.innerHTML = '<option value="">-- Pilih Juruteknik Bertugas --</option>' +
    currentStaffList.map(s => `<option value="${s.id}">${s.name} (${s.role}) - ${s.active_jobs} tugasan aktif</option>`).join('');

  document.getElementById('approveModal').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeApproveModal() {
  document.getElementById('approveModal').classList.add('hidden');
}

async function submitApproval() {
  const orderId = document.getElementById('app_order_id').value;
  const staffId = document.getElementById('app_staff_id').value;
  const estCost = document.getElementById('app_estimated_cost').value;
  const notes = document.getElementById('app_notes').value;

  try {
    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'approved',
        assigned_staff_id: staffId ? parseInt(staffId, 10) : null,
        estimated_cost: estCost ? parseFloat(estCost) : 0,
        notes: notes || undefined
      })
    });

    const data = await res.json();
    if (data.success) {
      closeApproveModal();
      loadOrders();
      loadMetrics();
      loadStaff();
      
      // Prompt admin to send WhatsApp confirmation
      if (confirm('Tempahan berjaya diluluskan! Adakah anda ingin hantar WhatsApp pengesahan kepada pelanggan sekarang?')) {
        triggerWhatsAppModal(orderId);
      }
    } else {
      alert(data.message || 'Gagal mengemaskini tempahan.');
    }
  } catch (err) {
    alert('Ralat semasa meluluskan tempahan.');
  }
}

async function updateOrderStatus(orderId, newStatus) {
  const promptText = {
    'in_progress': 'Tukar status kepada "Sedang Servis"?',
    'completed': 'Tandakan servis ini sebagai "Selesai"?',
    'rejected': 'Adakah anda pasti untuk MENOLAK tempahan ini?'
  };

  if (!confirm(promptText[newStatus] || `Tukar status kepada ${newStatus}?`)) return;

  try {
    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      loadOrders();
      loadMetrics();
      loadStaff();
    } else {
      alert(data.message);
    }
  } catch (err) {
    alert('Ralat sambungan.');
  }
}

async function deleteOrder(orderId, orderCode) {
  if (!confirm(`AMARAN: Adakah anda pasti mahu memadam tempahan #${orderCode}? Rekod ini tidak boleh dipulihkan.`)) return;

  try {
    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.success) {
      loadOrders();
      loadMetrics();
    } else {
      alert(data.message);
    }
  } catch (err) {
    alert('Ralat memadam tempahan.');
  }
}

// ---------------- 3. STAFF & DISPATCH ---------------- //
async function loadStaff() {
  try {
    const res = await fetch('/api/admin/staff');
    const data = await res.json();
    if (!data.success) return;

    currentStaffList = data.staff;
    const grid = document.getElementById('staffGrid');

    grid.innerHTML = data.staff.map(s => `
      <div class="fe-card p-5 space-y-3">
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm">
              ${s.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 class="font-bold text-slate-900">${escapeHtml(s.name)}</h3>
              <p class="text-xs text-sky-600 font-medium">${escapeHtml(s.role)}</p>
            </div>
          </div>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${s.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">
            ${s.status.toUpperCase()}
          </span>
        </div>

        <div class="text-xs text-slate-600 space-y-1">
          <div><strong>Telefon:</strong> ${s.phone || '-'}</div>
          <div><strong>Tugasan Aktif:</strong> <span class="font-bold text-sky-700">${s.active_jobs} order</span></div>
        </div>

        <div class="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
          <a href="https://wa.me/${s.phone ? s.phone.replace(/[^0-9]/g, '') : ''}" target="_blank" class="text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1">
            <i data-lucide="message-circle" class="w-3.5 h-3.5"></i> Hubungi
          </a>
          <button onclick="deleteStaff(${s.id}, '${escapeHtml(s.name)}')" class="text-rose-500 hover:text-rose-700 p-1">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('Error loading staff:', err);
  }
}

function openStaffModal() {
  document.getElementById('staffModal').classList.remove('hidden');
}
function closeStaffModal() {
  document.getElementById('staffModal').classList.add('hidden');
}

async function submitStaff(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('staff_name').value.trim(),
    phone: document.getElementById('staff_phone').value.trim(),
    role: document.getElementById('staff_role').value
  };

  try {
    const res = await fetch('/api/admin/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      closeStaffModal();
      loadStaff();
    } else {
      alert(data.message);
    }
  } catch (err) {
    alert('Ralat menambah staf.');
  }
}

async function deleteStaff(id, name) {
  if (!confirm(`Padam juruteknik ${name}?`)) return;
  try {
    await fetch(`/api/admin/staff/${id}`, { method: 'DELETE' });
    loadStaff();
  } catch (err) {
    alert('Ralat memadam staf.');
  }
}

// ---------------- 4. ERP INVENTORY ---------------- //
async function loadInventory() {
  try {
    const res = await fetch('/api/admin/inventory');
    const data = await res.json();
    if (!data.success) return;

    const tbody = document.getElementById('inventoryTableBody');
    tbody.innerHTML = data.items.map(item => {
      const isLow = item.quantity <= item.min_threshold;
      return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100 ${isLow ? 'bg-amber-50/40' : ''}">
          <td class="py-3 px-4 font-mono font-bold text-sky-700">${escapeHtml(item.item_code)}</td>
          <td class="py-3 px-4 font-semibold text-slate-800">${escapeHtml(item.name)}</td>
          <td class="py-3 px-4 text-slate-500">${escapeHtml(item.category)}</td>
          <td class="py-3 px-4">
            <span class="font-bold text-sm ${isLow ? 'text-rose-600' : 'text-slate-800'}">${item.quantity} ${escapeHtml(item.unit)}</span>
            ${isLow ? '<span class="ml-1.5 px-1.5 py-0.2 bg-rose-100 text-rose-700 rounded text-[10px] font-bold">Stok Rendah!</span>' : ''}
          </td>
          <td class="py-3 px-4 font-mono text-slate-600">RM ${item.unit_cost.toFixed(2)}</td>
          <td class="py-3 px-4 font-mono font-bold text-emerald-700">RM ${item.selling_price.toFixed(2)}</td>
          <td class="py-3 px-4 text-center">
            <div class="flex items-center justify-center gap-1.5">
              <button onclick="adjustStock(${item.id}, 1)" class="w-7 h-7 bg-slate-100 hover:bg-sky-100 hover:text-sky-700 font-bold rounded flex items-center justify-center transition" title="Tambah 1 Stok">+</button>
              <button onclick="adjustStock(${item.id}, -1)" class="w-7 h-7 bg-slate-100 hover:bg-rose-100 hover:text-rose-700 font-bold rounded flex items-center justify-center transition" title="Tolak 1 Stok">-</button>
              <button onclick="deleteInventoryItem(${item.id}, '${escapeHtml(item.name)}')" class="text-slate-400 hover:text-rose-600 p-1">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('Error loading inventory:', err);
  }
}

async function adjustStock(id, delta) {
  try {
    await fetch(`/api/admin/inventory/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adjust_qty: delta })
    });
    loadInventory();
    loadMetrics();
  } catch (err) {
    alert('Ralat mengemaskini stok.');
  }
}

function openInventoryModal() {
  document.getElementById('invModal').classList.remove('hidden');
}
function closeInventoryModal() {
  document.getElementById('invModal').classList.add('hidden');
}

async function submitInventory(e) {
  e.preventDefault();
  const payload = {
    item_code: document.getElementById('inv_code').value.trim(),
    category: document.getElementById('inv_cat').value,
    name: document.getElementById('inv_name').value.trim(),
    quantity: parseInt(document.getElementById('inv_qty').value, 10) || 0,
    unit: document.getElementById('inv_unit').value.trim(),
    unit_cost: parseFloat(document.getElementById('inv_cost').value) || 0,
    selling_price: parseFloat(document.getElementById('inv_price').value) || 0
  };

  try {
    const res = await fetch('/api/admin/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      closeInventoryModal();
      loadInventory();
      loadMetrics();
    } else {
      alert(data.message);
    }
  } catch (err) {
    alert('Ralat menambah inventori.');
  }
}

async function deleteInventoryItem(id, name) {
  if (!confirm(`Padam barang ${name} dari inventori?`)) return;
  try {
    await fetch(`/api/admin/inventory/${id}`, { method: 'DELETE' });
    loadInventory();
    loadMetrics();
  } catch (err) {
    alert('Ralat memadam inventori.');
  }
}

// ---------------- 5. ERP INVOICES & PRINTING ---------------- //
async function loadInvoices() {
  try {
    const res = await fetch('/api/admin/invoices');
    const data = await res.json();
    if (!data.success) return;

    const tbody = document.getElementById('invoicesTableBody');
    if (data.invoices.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-slate-400">Tiada invois dikeluarkan lagi.</td></tr>';
      return;
    }

    tbody.innerHTML = data.invoices.map(inv => {
      const isPaid = inv.payment_status === 'paid';
      return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
          <td class="py-3 px-4 font-mono font-bold text-sky-700">${escapeHtml(inv.invoice_no)}</td>
          <td class="py-3 px-4 font-mono text-slate-500">${escapeHtml(inv.order_code)}</td>
          <td class="py-3 px-4 font-semibold text-slate-900">${escapeHtml(inv.customer_name)}</td>
          <td class="py-3 px-4 text-slate-600">${escapeHtml(inv.service_type)}</td>
          <td class="py-3 px-4 font-mono font-bold text-slate-900">RM ${parseFloat(inv.total_amount).toFixed(2)}</td>
          <td class="py-3 px-4 text-slate-500">${escapeHtml(inv.payment_method)}</td>
          <td class="py-3 px-4">
            <button onclick="toggleInvoicePayment(${inv.id}, '${isPaid ? 'unpaid' : 'paid'}')" class="px-2.5 py-1 rounded-full text-xs font-bold transition ${isPaid ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}">
              ${isPaid ? 'DIBAYAR (PAID)' : 'BELUM BAYAR'}
            </button>
          </td>
          <td class="py-3 px-4 text-center">
            <button onclick="viewPrintInvoice(${inv.id})" class="bg-sky-50 hover:bg-sky-100 text-sky-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 mx-auto">
              <i data-lucide="printer" class="w-3.5 h-3.5"></i>
              <span>Cetak / Lihat</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('Error loading invoices:', err);
  }
}

function openCreateInvoiceModal(orderId, orderCode, customerName, serviceType, estCost) {
  document.getElementById('inv_order_id').value = orderId;
  document.getElementById('inv_customer_name').value = customerName;
  document.getElementById('inv_order_code_label').innerText = orderCode;
  document.getElementById('inv_cust_name_label').innerText = customerName;
  document.getElementById('inv_item_desc').value = `Servis & Pemasangan: ${serviceType}`;
  document.getElementById('inv_total_amount').value = estCost > 0 ? estCost : 120.00;

  document.getElementById('createInvoiceModal').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeCreateInvoiceModal() {
  document.getElementById('createInvoiceModal').classList.add('hidden');
}

async function submitCreateInvoice() {
  const orderId = document.getElementById('inv_order_id').value;
  const customerName = document.getElementById('inv_customer_name').value;
  const itemDesc = document.getElementById('inv_item_desc').value.trim();
  const total = parseFloat(document.getElementById('inv_total_amount').value) || 0;
  const paymentStatus = document.getElementById('inv_payment_status').value;
  const paymentMethod = document.getElementById('inv_payment_method').value;

  const items = [
    { description: itemDesc || 'Servis Flash Energy', qty: 1, unit_price: total, total: total }
  ];

  try {
    const res = await fetch('/api/admin/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: parseInt(orderId, 10),
        customer_name: customerName,
        total_amount: total,
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        items
      })
    });

    const data = await res.json();
    if (data.success) {
      closeCreateInvoiceModal();
      loadInvoices();
      loadOrders();
      loadMetrics();
      alert(`Invois rasmi berjaya dicipta: ${data.invoice_no}`);
    } else {
      alert(data.message);
    }
  } catch (err) {
    alert('Ralat menjana invois.');
  }
}

async function toggleInvoicePayment(id, newStatus) {
  try {
    await fetch(`/api/admin/invoices/${id}/payment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_status: newStatus })
    });
    loadInvoices();
    loadOrders();
    loadMetrics();
  } catch (err) {
    alert('Ralat kemaskini pembayaran.');
  }
}

async function viewPrintInvoice(id) {
  try {
    const res = await fetch(`/api/admin/invoices/${id}`);
    const data = await res.json();
    if (!data.success) return;

    const { invoice, company } = data;

    document.getElementById('pr_company_addr').innerText = company.company_address || 'No. 38 & 40, Tingkat 1, Jalan Intan, 96000 Sibu, Sarawak';
    document.getElementById('pr_company_contact').innerText = `Tel: ${company.company_phone || '018-959 6569'} | Emel: ${company.company_email || 'flashenergysibu@gmail.com'}`;

    document.getElementById('pr_inv_no').innerText = invoice.invoice_no;
    document.getElementById('pr_inv_date').innerText = `Tarikh: ${invoice.created_at.split(' ')[0]}`;
    document.getElementById('pr_cust_name').innerText = invoice.customer_name;
    document.getElementById('pr_cust_phone').innerText = invoice.phone;
    document.getElementById('pr_cust_addr').innerText = invoice.address;
    document.getElementById('pr_order_code').innerText = invoice.order_code;
    document.getElementById('pr_serv_date').innerText = invoice.preferred_date;

    const isPaid = invoice.payment_status === 'paid';
    document.getElementById('pr_pay_status').innerText = isPaid ? 'DIBAYAR (PAID)' : 'BELUM BAYAR (UNPAID)';
    document.getElementById('pr_pay_status').className = isPaid ? 'font-bold text-emerald-700' : 'font-bold text-amber-600';
    document.getElementById('pr_pay_method').innerText = invoice.payment_method;

    let items = [];
    try {
      items = JSON.parse(invoice.items_json);
    } catch (e) {
      items = [{ description: invoice.service_type, qty: 1, unit_price: invoice.total_amount, total: invoice.total_amount }];
    }

    const itemsBody = document.getElementById('pr_items_body');
    itemsBody.innerHTML = items.map((it, idx) => `
      <tr>
        <td class="py-2 px-3 border-b text-center">${idx + 1}</td>
        <td class="py-2 px-3 border-b">${escapeHtml(it.description)}</td>
        <td class="py-2 px-3 border-b text-center font-mono">${it.qty}</td>
        <td class="py-2 px-3 border-b text-right font-mono">RM ${parseFloat(it.unit_price).toFixed(2)}</td>
        <td class="py-2 px-3 border-b text-right font-mono font-bold">RM ${parseFloat(it.total).toFixed(2)}</td>
      </tr>
    `).join('');

    document.getElementById('pr_grand_total').innerText = `RM ${parseFloat(invoice.total_amount).toFixed(2)}`;

    document.getElementById('printInvoiceModal').classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    alert('Ralat membuka cetakan invois.');
  }
}

function closePrintInvoiceModal() {
  document.getElementById('printInvoiceModal').classList.add('hidden');
}

// ---------------- 6. SETTINGS & TEMPLATES ---------------- //
async function loadSettings() {
  try {
    const res = await fetch('/api/admin/settings');
    const data = await res.json();
    if (!data.success) return;

    const s = data.settings;
    if (document.getElementById('set_whatsapp_template')) {
      document.getElementById('set_whatsapp_template').value = s.whatsapp_template || '';
      document.getElementById('set_company_name').value = s.company_name || '';
      document.getElementById('set_company_phone').value = s.company_phone || '';
      document.getElementById('set_company_email').value = s.company_email || '';
      document.getElementById('set_company_facebook').value = s.company_facebook || '';
      document.getElementById('set_company_address').value = s.company_address || '';
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

async function saveSettings(e) {
  e.preventDefault();
  const payload = {
    whatsapp_template: document.getElementById('set_whatsapp_template').value.trim(),
    company_name: document.getElementById('set_company_name').value.trim(),
    company_phone: document.getElementById('set_company_phone').value.trim(),
    company_email: document.getElementById('set_company_email').value.trim(),
    company_facebook: document.getElementById('set_company_facebook').value.trim(),
    company_address: document.getElementById('set_company_address').value.trim()
  };

  try {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      alert('Tetapan dan templat WhatsApp berjaya disimpan!');
    } else {
      alert(data.message);
    }
  } catch (err) {
    alert('Ralat menyimpan tetapan.');
  }
}

function insertVariable(varName) {
  const el = document.getElementById('set_whatsapp_template');
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const text = el.value;
  el.value = text.substring(0, start) + varName + text.substring(end);
  el.focus();
  el.selectionStart = el.selectionEnd = start + varName.length;
}

// Utility: escape html
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
