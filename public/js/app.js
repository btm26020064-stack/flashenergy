// Sub-service categories configuration
const subServices = {
  'Air Conditioning Service & Installation': [
    'Chemical Wash & General Overhaul (Disyorkan)',
    'Normal Servicing & Filter Cleaning',
    'Gas Refill (R32 / R410A)',
    'Aircond Menitik Air / Salur Tersumbat',
    'Aircond Tak Sejuk / Sensor Rosak',
    'Pemasangan Unit Baru (1.0HP - 2.5HP)',
    'Buka & Alih Aircond (Relocation)',
    'Pemeriksaan & Troubleshooting Kompresor'
  ],
  'Electric Wiring': [
    'Wiring Repair / Masalah Elektrik Selalu Trip',
    'Naik Taraf Kotak Agihan (DB Box) & MCB Breaker',
    'Pemasangan Suis, Lampu LED & Kipas Siling',
    'Tambah Mata Soket Plug 13A / 15A Baru',
    'Pendawaian Khas Water Heater / Aircond Baru',
    'Pendawaian Autogate / Pagar Elektrik',
    'Pendawaian Penuh Rumah / Premis Kedai (Full Rewiring)',
    'Pemeriksaan Keselamatan Litar Elektrik'
  ]
};

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  // Set min date to today (local time)
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const dateInput = document.getElementById('preferred_date');
  if (dateInput) {
    dateInput.min = today;
    dateInput.value = today;
  }

  toggleSubServices();

  // Attach submit handler
  const form = document.getElementById('orderForm');
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }
});

// Update sub-services dropdown
function toggleSubServices() {
  const selectedType = document.querySelector('input[name="service_type"]:checked')?.value || 'Air Conditioning Service & Installation';
  const subSelect = document.getElementById('service_subtype');
  const labelAc = document.getElementById('label-ac');
  const labelWiring = document.getElementById('label-wiring');

  if (selectedType === 'Air Conditioning Service & Installation') {
    labelAc.classList.add('border-sky-500', 'bg-sky-50/60');
    labelAc.classList.remove('border-slate-200');
    labelWiring.classList.remove('border-sky-500', 'bg-sky-50/60');
    labelWiring.classList.add('border-slate-200');
  } else {
    labelWiring.classList.add('border-sky-500', 'bg-sky-50/60');
    labelWiring.classList.remove('border-slate-200');
    labelAc.classList.remove('border-sky-500', 'bg-sky-50/60');
    labelAc.classList.add('border-slate-200');
  }

  if (subSelect && subServices[selectedType]) {
    subSelect.innerHTML = subServices[selectedType]
      .map(item => `<option value="${item}">${item}</option>`)
      .join('');
  }
}

// Quick append area to address textarea
function appendArea(areaName) {
  const addressInput = document.getElementById('address');
  if (!addressInput) return;
  const current = addressInput.value.trim();
  if (current.includes(areaName)) return;

  if (current) {
    addressInput.value = `${current}, ${areaName}, 96000 Sibu, Sarawak`;
  } else {
    addressInput.value = `${areaName}, 96000 Sibu, Sarawak`;
  }
  addressInput.focus();
}

// Handle order form submission
async function handleFormSubmit(e) {
  e.preventDefault();

  const submitBtn = document.getElementById('submitBtn');
  const originalBtnHtml = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="inline-block animate-spin mr-2">·</span> Menghantar...`;

  const service_type = document.querySelector('input[name="service_type"]:checked').value;
  const payload = {
    customer_name: document.getElementById('customer_name').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    email: document.getElementById('email').value.trim(),
    address: document.getElementById('address').value.trim(),
    service_type,
    service_subtype: document.getElementById('service_subtype').value,
    units_count: parseInt(document.getElementById('units_count').value, 10) || 1,
    preferred_date: document.getElementById('preferred_date').value,
    preferred_time_slot: document.getElementById('preferred_time_slot').value,
    notes: document.getElementById('notes').value.trim()
  };

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.success) {
      // Show success modal
      document.getElementById('succ_code').innerText = data.order.order_code;
      document.getElementById('succ_name').innerText = data.order.customer_name;
      document.getElementById('succ_date').innerText = data.order.preferred_date;
      document.getElementById('succ_service').innerText = `${data.order.service_type}`;
      
      const waBtn = document.getElementById('succ_wa_btn');
      waBtn.href = data.order.customerWaUrl;

      document.getElementById('successModal').classList.remove('hidden');
      document.getElementById('orderForm').reset();
      toggleSubServices();
    } else {
      alert('Ralat: ' + (data.message || 'Tidak dapat menghantar tempahan. Sila cuba lagi.'));
    }
  } catch (err) {
    alert('Ralat rangkaian. Sila pastikan sambungan internet anda aktif.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnHtml;
    if (window.lucide) lucide.createIcons();
  }
}

function closeSuccessModal() {
  document.getElementById('successModal').classList.add('hidden');
}

// Track modal logic
function openTrackModal() {
  document.getElementById('trackModal').classList.remove('hidden');
  document.getElementById('trackInput').focus();
}

function closeTrackModal() {
  document.getElementById('trackModal').classList.add('hidden');
}

async function performTracking() {
  const query = document.getElementById('trackInput').value.trim();
  const container = document.getElementById('trackResults');

  if (!query) {
    container.innerHTML = '<p class="text-xs text-rose-500 py-2">Sila taip No. Tempahan atau No. Telefon.</p>';
    return;
  }

  container.innerHTML = '<p class="text-xs text-slate-500 py-2">Sedang mencari rekod tempahan...</p>';

  try {
    const res = await fetch(`/api/orders/track?query=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (!data.success || !data.orders || data.orders.length === 0) {
      container.innerHTML = `<div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
        Tiada rekod tempahan dijumpai untuk "${query}". Sila semak semula nombor telefon atau kod rujukan anda.
      </div>`;
      return;
    }

    const statusMap = {
      'pending': { label: 'Menunggu Pengesahan', bg: 'bg-amber-100 text-amber-800' },
      'approved': { label: 'Telah Diluluskan', bg: 'bg-sky-100 text-sky-800' },
      'in_progress': { label: 'Juruteknik Sedang Servis', bg: 'bg-purple-100 text-purple-800' },
      'completed': { label: 'Selesai', bg: 'bg-emerald-100 text-emerald-800' },
      'rejected': { label: 'Dibatalkan / Ditolak', bg: 'bg-rose-100 text-rose-800' }
    };

    container.innerHTML = data.orders.map(o => {
      const st = statusMap[o.status] || { label: o.status, bg: 'bg-slate-100 text-slate-700' };
      return `
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs text-slate-700">
          <div class="flex items-center justify-between">
            <span class="font-mono font-bold text-sky-700">${o.order_code}</span>
            <span class="px-2 py-0.5 rounded-full font-semibold ${st.bg}">${st.label}</span>
          </div>
          <div><strong>Servis:</strong> ${o.service_type} (${o.service_subtype || '-'})</div>
          <div><strong>Tarikh Servis:</strong> ${o.preferred_date} - ${o.preferred_time_slot}</div>
          <div><strong>Alamat:</strong> ${o.address}</div>
          ${o.staff_name ? `<div class="text-emerald-700 font-semibold">Juruteknik Bertugas: ${o.staff_name} (${o.staff_phone || ''})</div>` : ''}
        </div>
      `;
    }).join('');

  } catch (err) {
    container.innerHTML = '<p class="text-xs text-rose-500 py-2">Ralat sambungan. Sila cuba lagi.</p>';
  }
}
