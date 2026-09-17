document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  buildNavbar('dashboard');
  loadDashboard();
});

async function loadDashboard() {
  try {
    const data = await api.get('/dashboard/stats');

    // Stats cards
    document.getElementById('stat-occupancy').textContent = `${data.occupancy.percentage}%`;
    document.getElementById('stat-revenue').textContent = formatCurrency(data.today.revenue);
    document.getElementById('stat-active').textContent = data.today.active;
    document.getElementById('stat-today').textContent = data.today.checkIns;

    // Type stats
    const typeContainer = document.getElementById('type-stats');
    if (data.byType.length === 0) {
      typeContainer.innerHTML = '<div class="empty-state"><p>No spot data available</p></div>';
    } else {
      typeContainer.innerHTML = data.byType.map(t => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--divider);">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.2rem;">${getVehicleEmoji(t.spot_type)}</span>
            <div>
              <div style="font-weight:600;text-transform:capitalize;">${t.spot_type}</div>
              <div style="font-size:0.75rem;color:var(--text-muted);">${t.available} available / ${t.total} total</div>
            </div>
          </div>
          <div style="text-align:right;">
            <span class="${getBadgeClass(t.spot_type)}">${t.occupied} occupied</span>
          </div>
        </div>
        <div class="progress-bar">
          <div class="progress-bar-fill" style="width:${t.total > 0 ? Math.round((t.occupied / t.total) * 100) : 0}%"></div>
        </div>
      `).join('');
    }

    // Level stats
    const levelContainer = document.getElementById('level-stats');
    if (data.levelStats.length === 0) {
      levelContainer.innerHTML = '<div class="empty-state"><p>No level data available</p></div>';
    } else {
      levelContainer.innerHTML = data.levelStats.map(l => {
        const pct = l.total > 0 ? Math.round((l.occupied / l.total) * 100) : 0;
        return `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--divider);">
            <div>
              <div style="font-weight:600;">${l.name}</div>
              <div style="font-size:0.75rem;color:var(--text-muted);">${l.occupied} / ${l.total} spots used</div>
            </div>
            <div style="font-weight:700;color:${pct > 80 ? 'var(--accent-red)' : pct > 50 ? 'var(--accent-amber)' : 'var(--accent-green)'};">
              ${pct}%
            </div>
          </div>
          <div class="progress-bar">
            <div class="progress-bar-fill" style="width:${pct}%"></div>
          </div>
        `;
      }).join('');
    }

    // Recent activity
    const activityTbody = document.getElementById('recent-activity');
    if (data.recentActivity.length === 0) {
      activityTbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🅿️</div><p>No parking activity yet</p></div></td></tr>';
    } else {
      activityTbody.innerHTML = data.recentActivity.map(r => `
        <tr>
          <td><strong>${r.plate_number}</strong></td>
          <td><span class="${getBadgeClass(r.vehicle_type)}">${getVehicleEmoji(r.vehicle_type)} ${r.vehicle_type}</span></td>
          <td>${r.spot_number}</td>
          <td>${r.level_name}</td>
          <td>${formatDate(r.check_in_time)}</td>
          <td>${r.check_out_time
            ? '<span class="badge badge-completed">Completed</span>'
            : '<span class="badge badge-active">● Active</span>'
          }</td>
          <td>${r.fee != null ? formatCurrency(r.fee) : '—'}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Dashboard load error:', err);
    showToast(err.message, 'error');
  }
}
