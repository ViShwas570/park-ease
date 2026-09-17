let pendingCheckoutId = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  buildNavbar('checkout');

  // Enter key to search
  document.getElementById('search-plate').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') searchActiveCars();
  });
});

async function searchActiveCars() {
  const plate = document.getElementById('search-plate').value.trim();
  if (!plate) {
    showToast('Enter a plate number to search', 'error');
    return;
  }

  try {
    const data = await api.get(`/parking/search?plate=${encodeURIComponent(plate)}`);
    // Filter only active records
    const active = data.data.filter(r => !r.check_out_time);
    displayActiveVehicles(active);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadAllActive() {
  try {
    const data = await api.get('/parking/active?limit=50');
    displayActiveVehicles(data.data);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function displayActiveVehicles(records) {
  const container = document.getElementById('active-vehicles');
  const tbody = document.getElementById('active-tbody');
  container.classList.remove('hidden');

  if (records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🅿️</div><p>No active vehicles found</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = records.map(r => {
    const checkIn = new Date(r.check_in_time.includes('Z') ? r.check_in_time : r.check_in_time + 'Z');
    const now = new Date();
    const diffMs = now - checkIn;
    const hours = Math.ceil(diffMs / (1000 * 60 * 60));
    const mins = Math.floor(diffMs / (1000 * 60));

    let durationStr;
    if (mins < 60) {
      durationStr = `${mins} min`;
    } else {
      durationStr = `${Math.floor(mins / 60)}h ${mins % 60}m`;
    }

    return `
      <tr>
        <td><strong>${r.plate_number}</strong></td>
        <td><span class="${getBadgeClass(r.vehicle_type)}">${getVehicleEmoji(r.vehicle_type)} ${r.vehicle_type}</span></td>
        <td>${r.spot_number}</td>
        <td>${r.level_name}</td>
        <td>${formatDate(r.check_in_time)}</td>
        <td>${durationStr} <span style="color:var(--text-muted);font-size:0.75rem;">(${hours}h billed)</span></td>
        <td><button class="btn btn-danger btn-sm" onclick="initiateCheckout(${r.id}, '${r.plate_number}', '${r.vehicle_type}', '${durationStr}')">Check Out</button></td>
      </tr>
    `;
  }).join('');
}

function initiateCheckout(id, plate, type, duration) {
  pendingCheckoutId = id;
  document.getElementById('confirm-text').innerHTML = `
    Check out <strong>${plate}</strong> (${getVehicleEmoji(type)} ${type})?<br>
    <span style="color:var(--text-muted);font-size:0.85rem;">Duration: ${duration} — fee will be calculated automatically.</span>
  `;
  document.getElementById('confirm-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('confirm-modal').classList.add('hidden');
  pendingCheckoutId = null;
}

async function confirmCheckout() {
  if (!pendingCheckoutId) return;

  const btn = document.getElementById('confirm-checkout-btn');
  btn.disabled = true;
  btn.textContent = 'Processing...';

  try {
    const data = await api.post(`/parking/check-out/${pendingCheckoutId}`);
    closeModal();

    showToast(`${data.receipt.plate_number} checked out — Fee: ${formatCurrency(data.receipt.fee)}`, 'success');

    // Show receipt
    const receiptContainer = document.getElementById('checkout-receipt');
    receiptContainer.classList.remove('hidden');
    receiptContainer.innerHTML = `
      <div class="receipt">
        <h2>🧾 Parking Receipt</h2>
        <div class="receipt-row">
          <span class="label">Receipt #</span>
          <span class="value">${data.receipt.id}</span>
        </div>
        <div class="receipt-row">
          <span class="label">Plate Number</span>
          <span class="value">${data.receipt.plate_number}</span>
        </div>
        <div class="receipt-row">
          <span class="label">Vehicle Type</span>
          <span class="value" style="text-transform:capitalize;">${getVehicleEmoji(data.receipt.vehicle_type)} ${data.receipt.vehicle_type}</span>
        </div>
        <div class="receipt-row">
          <span class="label">Spot</span>
          <span class="value">${data.receipt.spot_number} (${data.receipt.level})</span>
        </div>
        <div class="receipt-row">
          <span class="label">Check In</span>
          <span class="value">${formatDate(data.receipt.check_in_time)}</span>
        </div>
        <div class="receipt-row">
          <span class="label">Check Out</span>
          <span class="value">${formatDate(data.receipt.check_out_time)}</span>
        </div>
        <div class="receipt-row">
          <span class="label">Duration</span>
          <span class="value">${data.receipt.duration_hours} hour(s)</span>
        </div>
        <div class="receipt-row">
          <span class="label">Rate</span>
          <span class="value" style="font-size:0.8rem;">1st hr: ${formatCurrency(data.receipt.pricing_applied.first_hour)} | Extra: ${formatCurrency(data.receipt.pricing_applied.additional_per_hour)}/hr | Cap: ${formatCurrency(data.receipt.pricing_applied.daily_cap)}</span>
        </div>
        <div class="receipt-total">
          <span>Total Fee</span>
          <span class="value">${formatCurrency(data.receipt.fee)}</span>
        </div>
      </div>
    `;

    // Hide active vehicles
    document.getElementById('active-vehicles').classList.add('hidden');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✓ Check Out & Pay';
  }
}
