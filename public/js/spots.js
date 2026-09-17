document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  buildNavbar('spots');
  loadSpots();
});

async function loadSpots() {
  const type = document.getElementById('filter-type').value;
  const status = document.getElementById('filter-status').value;
  const container = document.getElementById('levels-container');

  try {
    // Get levels
    const levelData = await api.get('/spots/levels');
    const levels = levelData.levels;

    // Get all spots with filters
    let query = '/spots?limit=200';
    if (type) query += `&type=${type}`;
    if (status) query += `&status=${status}`;

    const spotData = await api.get(query);
    const spots = spotData.data;

    // Summary
    const totalSpots = spots.length;
    const available = spots.filter(s => !s.is_occupied).length;
    const occupied = spots.filter(s => s.is_occupied).length;
    document.getElementById('spot-summary').innerHTML = `
      <span style="color:var(--accent-green);">🟢 ${available} Available</span>
      <span style="color:var(--accent-red);">🔴 ${occupied} Occupied</span>
      <span style="color:var(--text-muted);">Total: ${totalSpots}</span>
    `;

    // Group spots by level
    const spotsByLevel = {};
    spots.forEach(s => {
      if (!spotsByLevel[s.level_id]) {
        spotsByLevel[s.level_id] = { name: s.level_name, spots: [] };
      }
      spotsByLevel[s.level_id].spots.push(s);
    });

    if (Object.keys(spotsByLevel).length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">🅿️</div><p>No spots match the current filter</p></div>';
      return;
    }

    container.innerHTML = levels.map(level => {
      const levelSpots = spotsByLevel[level.id];
      if (!levelSpots) return '';

      const occ = level.occupied_spots;
      const tot = level.total_spots;
      const pct = tot > 0 ? Math.round((occ / tot) * 100) : 0;

      return `
        <div class="card mb-4">
          <div class="card-header">
            <div>
              <div class="card-title">${level.name}</div>
              <div class="card-subtitle">${occ} / ${tot} occupied (${pct}%)</div>
            </div>
            <div class="progress-bar" style="width:120px;">
              <div class="progress-bar-fill" style="width:${pct}%"></div>
            </div>
          </div>
          <div class="spot-grid">
            ${levelSpots.spots.map(s => `
              <div class="spot-cell ${s.is_occupied ? 'occupied' : 'available'}" title="${s.spot_number} — ${s.spot_type}${s.current_plate ? ' — ' + s.current_plate : ''}">
                <span class="spot-type-icon">${getVehicleEmoji(s.spot_type)}</span>
                <span class="spot-id">${s.spot_number}</span>
                ${s.current_plate ? `<span class="spot-plate">${s.current_plate}</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Load spots error:', err);
    container.innerHTML = `<div class="alert alert-error">⚠️ ${err.message}</div>`;
  }
}
