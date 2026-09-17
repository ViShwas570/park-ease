document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  buildNavbar('checkin');
  loadAvailableSpots();

  document.getElementById('checkin-form').addEventListener('submit', handleCheckIn);
});

async function loadAvailableSpots() {
  try {
    const data = await api.get('/spots/available');
    const container = document.getElementById('available-spots');

    if (data.summary.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No spots configured</p></div>';
      return;
    }

    container.innerHTML = data.summary.map(s => {
      const pct = s.total > 0 ? Math.round((s.available / s.total) * 100) : 0;
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--divider);">
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-size:1.5rem;">${getVehicleEmoji(s.spot_type)}</span>
            <div>
              <div style="font-weight:700;text-transform:capitalize;font-size:1rem;">${s.spot_type}</div>
              <div style="font-size:0.8rem;color:var(--text-muted);">${s.available} of ${s.total} available</div>
            </div>
          </div>
          <div style="font-size:1.5rem;font-weight:800;color:${s.available > 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">
            ${s.available}
          </div>
        </div>
        <div class="progress-bar" style="margin-bottom:8px;">
          <div class="progress-bar-fill" style="width:${100 - pct}%"></div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Load spots error:', err);
  }
}

async function handleCheckIn(e) {
  e.preventDefault();
  const btn = document.getElementById('checkin-btn');
  const plate = document.getElementById('plate_number').value.trim();
  const type = document.getElementById('vehicle_type').value;

  if (!plate || !type) return;

  btn.disabled = true;
  btn.textContent = 'Checking in...';

  try {
    const data = await api.post('/parking/check-in', {
      plate_number: plate,
      vehicle_type: type
    });

    showToast(`${data.record.plate_number} checked in at ${data.record.spot_number}`, 'success');

    // Show result card
    const result = document.getElementById('checkin-result');
    result.classList.remove('hidden');
    result.innerHTML = `
      <div class="card" style="border-color: var(--accent-green); max-width:500px;">
        <h3 style="color: var(--accent-green); margin-bottom: 16px;">✅ Vehicle Checked In Successfully</h3>
        <div class="receipt-row">
          <span class="label">Plate Number</span>
          <span class="value">${data.record.plate_number}</span>
        </div>
        <div class="receipt-row">
          <span class="label">Vehicle Type</span>
          <span class="value" style="text-transform:capitalize;">${getVehicleEmoji(data.record.vehicle_type)} ${data.record.vehicle_type}</span>
        </div>
        <div class="receipt-row">
          <span class="label">Assigned Spot</span>
          <span class="value">${data.record.spot_number}</span>
        </div>
        <div class="receipt-row">
          <span class="label">Level</span>
          <span class="value">${data.record.level}</span>
        </div>
        <div class="receipt-row">
          <span class="label">Check-in Time</span>
          <span class="value">${formatDate(data.record.check_in_time)}</span>
        </div>
        <div style="margin-top:20px;">
          <button class="btn btn-primary btn-sm" onclick="resetForm()">Check In Another</button>
        </div>
      </div>
    `;

    // Refresh availability
    loadAvailableSpots();

    // Reset form
    document.getElementById('checkin-form').reset();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✓ Check In Vehicle';
  }
}

function resetForm() {
  document.getElementById('checkin-result').classList.add('hidden');
  document.getElementById('plate_number').focus();
}
