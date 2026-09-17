let currentPage = 1;
let isSearching = false;
let searchTerm = '';

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  buildNavbar('log');
  loadLog();

  document.getElementById('search-plate').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') handleSearch();
  });
});

function handleSearch() {
  const plate = document.getElementById('search-plate').value.trim();
  if (!plate) return;
  searchTerm = plate;
  isSearching = true;
  currentPage = 1;
  loadLog();
}

function clearSearch() {
  document.getElementById('search-plate').value = '';
  searchTerm = '';
  isSearching = false;
  currentPage = 1;
  loadLog();
}

async function loadLog() {
  const sortBy = document.getElementById('sort-by').value;
  const order = document.getElementById('sort-order').value;
  const tbody = document.getElementById('log-tbody');

  try {
    let data;
    if (isSearching && searchTerm) {
      data = await api.get(`/parking/search?plate=${encodeURIComponent(searchTerm)}&page=${currentPage}&limit=10&sortBy=${sortBy}&order=${order}`);
    } else {
      data = await api.get(`/parking/history?page=${currentPage}&limit=10&sortBy=${sortBy}&order=${order}`);
    }

    if (data.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><div class="empty-icon">📋</div><p>No parking records found</p></div></td></tr>';
    } else {
      tbody.innerHTML = data.data.map(r => `
        <tr>
          <td style="color:var(--text-muted);font-family:var(--font-mono);font-size:0.8rem;">#${r.id}</td>
          <td><strong>${r.plate_number}</strong></td>
          <td><span class="${getBadgeClass(r.vehicle_type)}">${getVehicleEmoji(r.vehicle_type)} ${r.vehicle_type}</span></td>
          <td>${r.spot_number}</td>
          <td>${r.level_name}</td>
          <td>${formatDate(r.check_in_time)}</td>
          <td>${r.check_out_time ? formatDate(r.check_out_time) : '—'}</td>
          <td>${r.duration_hours != null ? r.duration_hours + 'h' : '—'}</td>
          <td>${r.fee != null ? formatCurrency(r.fee) : '—'}</td>
          <td>${r.check_out_time
            ? '<span class="badge badge-completed">Completed</span>'
            : '<span class="badge badge-active">● Active</span>'
          }</td>
        </tr>
      `).join('');
    }

    buildPagination('log-pagination', data.pagination, (page) => {
      currentPage = page;
      loadLog();
    });
  } catch (err) {
    console.error('Log load error:', err);
    showToast(err.message, 'error');
  }
}
