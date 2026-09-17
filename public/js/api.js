/**
 * ParkEase — Shared API Client & Auth Helper
 * Handles JWT token management, fetch wrapper, and common utilities.
 */

const API_BASE = '/api';

// ── Token Management ──
function getToken() {
  return localStorage.getItem('parkease_token');
}

function setToken(token) {
  localStorage.setItem('parkease_token', token);
}

function removeToken() {
  localStorage.removeItem('parkease_token');
  localStorage.removeItem('parkease_user');
}

function getUser() {
  const data = localStorage.getItem('parkease_user');
  return data ? JSON.parse(data) : null;
}

function setUser(user) {
  localStorage.setItem('parkease_user', JSON.stringify(user));
}

function isLoggedIn() {
  return !!getToken();
}

function logout() {
  removeToken();
  window.location.href = '/login.html';
}

// ── Fetch Wrapper ──
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  // Handle 401 — token expired or invalid
  if (response.status === 401) {
    removeToken();
    if (!window.location.pathname.includes('login') && !window.location.pathname.includes('register')) {
      window.location.href = '/login.html';
    }
    throw new Error('Session expired. Please login again.');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong.');
  }

  return data;
}

// ── Convenience Methods ──
const api = {
  get: (endpoint) => apiFetch(endpoint),
  post: (endpoint, body) => apiFetch(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => apiFetch(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint) => apiFetch(endpoint, { method: 'DELETE' })
};

// ── Auth Guard ──
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

// ── Toast Notifications ──
function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
    if (container.children.length === 0) {
      container.remove();
    }
  }, 3000);
}

// ── Build Navbar ──
function buildNavbar(activePage) {
  const user = getUser();
  const isAuth = isLoggedIn();

  const nav = document.getElementById('main-nav');
  if (!nav) return;

  const links = isAuth ? [
    { href: '/dashboard.html', label: '📊 Dashboard', id: 'dashboard' },
    { href: '/checkin.html', label: '🚗 Check In', id: 'checkin' },
    { href: '/checkout.html', label: '🏁 Check Out', id: 'checkout' },
    { href: '/log.html', label: '📋 Log', id: 'log' },
    { href: '/spots.html', label: '🅿️ Spots', id: 'spots' },
    { href: '/pricing.html', label: '💰 Pricing', id: 'pricing' }
  ] : [];

  nav.innerHTML = `
    <div class="container" style="display:flex;align-items:center;justify-content:space-between;width:100%;max-width:1280px;margin:0 auto;">
      <a href="${isAuth ? '/dashboard.html' : '/'}" class="navbar-brand">
        <div class="brand-icon">🅿️</div>
        ParkEase
      </a>
      <button class="nav-toggle" onclick="document.querySelector('.navbar-links').classList.toggle('open')">☰</button>
      <ul class="navbar-links">
        ${links.map(l => `<li><a href="${l.href}" class="${activePage === l.id ? 'active' : ''}">${l.label}</a></li>`).join('')}
      </ul>
      <div class="navbar-user">
        ${isAuth ? `
          <span class="user-badge">👤 ${user?.username || 'User'} (${user?.role || 'attendant'})</span>
          <button class="btn-logout" onclick="logout()">Logout</button>
        ` : `
          <a href="/login.html" class="btn btn-primary btn-sm">Login</a>
        `}
      </div>
    </div>
  `;
}

// ── Format helpers ──
function formatCurrency(amount) {
  return `₹${Number(amount).toFixed(2)}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr.includes('Z') ? dateStr : dateStr + 'Z');
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function getVehicleEmoji(type) {
  switch (type) {
    case 'compact': return '🚗';
    case 'standard': return '🚙';
    case 'ev': return '⚡';
    default: return '🚗';
  }
}

function getBadgeClass(type) {
  return `badge badge-${type}`;
}

// ── Pagination Builder ──
function buildPagination(containerId, pagination, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { page, totalPages, total } = pagination;
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = `<button ${page <= 1 ? 'disabled' : ''} onclick="window.__paginate(${page - 1})">← Prev</button>`;

  for (let i = 1; i <= totalPages; i++) {
    if (i === page) {
      html += `<button class="active">${i}</button>`;
    } else if (Math.abs(i - page) <= 2 || i === 1 || i === totalPages) {
      html += `<button onclick="window.__paginate(${i})">${i}</button>`;
    } else if (Math.abs(i - page) === 3) {
      html += `<span class="pagination-info">…</span>`;
    }
  }

  html += `<button ${page >= totalPages ? 'disabled' : ''} onclick="window.__paginate(${page + 1})">Next →</button>`;
  html += `<span class="pagination-info">${total} total</span>`;

  container.innerHTML = html;
  window.__paginate = onPageChange;
}
