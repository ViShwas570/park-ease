document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  buildNavbar('pricing');
  loadPricing();

  document.getElementById('edit-pricing-form').addEventListener('submit', handleEditPricing);
});

async function loadPricing() {
  try {
    const data = await api.get('/pricing');
    const grid = document.getElementById('pricing-grid');
    const user = getUser();
    const isAdmin = user && user.role === 'admin';

    grid.innerHTML = data.pricing.map(p => `
      <div class="card" style="text-align:center;">
        <div style="font-size:2.5rem;margin-bottom:12px;">${getVehicleEmoji(p.vehicle_type)}</div>
        <h3 style="text-transform:capitalize;font-size:1.3rem;margin-bottom:4px;">${p.vehicle_type}</h3>
        <div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:24px;">Parking rates</div>

        <div style="margin-bottom:16px;">
          <div style="font-size:2rem;font-weight:800;color:var(--primary-light);">${formatCurrency(p.first_hour_rate)}</div>
          <div style="color:var(--text-muted);font-size:0.8rem;">First Hour</div>
        </div>

        <div class="receipt-row">
          <span class="label">Additional Hour</span>
          <span class="value">${formatCurrency(p.additional_hour_rate)}</span>
        </div>
        <div class="receipt-row">
          <span class="label">Daily Cap</span>
          <span class="value" style="color:var(--accent-green);">${formatCurrency(p.daily_cap)}</span>
        </div>

        <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--divider);font-size:0.75rem;color:var(--text-muted);">
          <strong>Example:</strong> 3 hours = ${formatCurrency(p.first_hour_rate + 2 * p.additional_hour_rate)}
        </div>

        ${isAdmin ? `
          <button class="btn btn-outline btn-sm mt-2" onclick="openEditModal(${p.id}, '${p.vehicle_type}', ${p.first_hour_rate}, ${p.additional_hour_rate}, ${p.daily_cap})">
            ✏️ Edit
          </button>
        ` : ''}
      </div>
    `).join('');
  } catch (err) {
    console.error('Pricing load error:', err);
    showToast(err.message, 'error');
  }
}

function openEditModal(id, type, firstHour, additional, cap) {
  document.getElementById('edit-id').value = id;
  document.getElementById('edit-type').textContent = `Editing pricing for: ${type.charAt(0).toUpperCase() + type.slice(1)}`;
  document.getElementById('edit-first-hour').value = firstHour;
  document.getElementById('edit-additional').value = additional;
  document.getElementById('edit-cap').value = cap;
  document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
}

async function handleEditPricing(e) {
  e.preventDefault();
  const id = document.getElementById('edit-id').value;
  const first_hour_rate = parseFloat(document.getElementById('edit-first-hour').value);
  const additional_hour_rate = parseFloat(document.getElementById('edit-additional').value);
  const daily_cap = parseFloat(document.getElementById('edit-cap').value);

  try {
    await api.put(`/pricing/${id}`, { first_hour_rate, additional_hour_rate, daily_cap });
    showToast('Pricing updated successfully', 'success');
    closeEditModal();
    loadPricing();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
