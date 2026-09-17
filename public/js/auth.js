// Auth page JS — handles login and registration forms
document.addEventListener('DOMContentLoaded', () => {
  // Redirect if already logged in
  if (isLoggedIn()) {
    window.location.href = '/dashboard.html';
    return;
  }

  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('login-btn');
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;

      btn.disabled = true;
      btn.textContent = 'Signing in...';
      clearAlert();

      try {
        const data = await api.post('/auth/login', { username, password });
        setToken(data.token);
        setUser(data.user);
        window.location.href = '/dashboard.html';
      } catch (err) {
        showAlert(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('register-btn');
      const username = document.getElementById('username').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;

      btn.disabled = true;
      btn.textContent = 'Creating account...';
      clearAlert();

      try {
        const data = await api.post('/auth/register', { username, email, password });
        setToken(data.token);
        setUser(data.user);
        window.location.href = '/dashboard.html';
      } catch (err) {
        showAlert(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Create Account';
      }
    });
  }
});

function showAlert(message, type = 'error') {
  const container = document.getElementById('alert-container');
  if (!container) return;
  container.innerHTML = `<div class="alert alert-${type}">${type === 'error' ? '⚠️' : '✅'} ${message}</div>`;
}

function clearAlert() {
  const container = document.getElementById('alert-container');
  if (container) container.innerHTML = '';
}
