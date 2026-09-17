// Landing page — redirect logged-in users to dashboard
document.addEventListener('DOMContentLoaded', () => {
  buildNavbar('landing');

  // If already logged in, redirect to dashboard
  if (isLoggedIn()) {
    const heroGetStarted = document.getElementById('hero-get-started');
    const heroLogin = document.getElementById('hero-login');
    if (heroGetStarted) {
      heroGetStarted.textContent = 'Go to Dashboard';
      heroGetStarted.href = '/dashboard.html';
    }
    if (heroLogin) {
      heroLogin.style.display = 'none';
    }
  }

  // Animate elements on scroll
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.feature-card, .roadmap-item').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'all 0.5s ease';
    observer.observe(el);
  });
});
