// public/js/api.js
// Shared helpers for making API calls from any frontend page.
// All API calls go through these functions to keep code DRY.

/**
 * Makes a fetch request to a relative /api URL.
 * Returns { data, error } so every caller can check both.
 */
async function apiRequest(method, url, body = null) {
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Send cookies (session) with every request
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      // Return the server's error message
      return { data: null, error: data.error || 'Something went wrong.' };
    }
    return { data, error: null };
  } catch (err) {
    // Network error (e.g., server is down)
    return { data: null, error: 'Network error. Please check your connection.' };
  }
}

// Shortcut helpers
const api = {
  get: (url) => apiRequest('GET', url),
  post: (url, body) => apiRequest('POST', url, body),
  put: (url, body) => apiRequest('PUT', url, body),
  delete: (url) => apiRequest('DELETE', url),
};

/**
 * Shows an alert message to the user.
 * @param {string} elementId - the id of the .alert div
 * @param {string} message   - text to display
 * @param {'error'|'success'|'info'} type
 */
function showAlert(elementId, message, type = 'error') {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.className = `alert alert-${type} show`;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Hides an alert element.
 */
function hideAlert(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.className = 'alert';
}

/**
 * Toggles password field visibility.
 * Expects a <button> with data-target="inputId" and two child SVG elements.
 */
function initPasswordToggle(btnId) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.addEventListener('click', () => {
    const inp = document.getElementById(btn.dataset.target);
    if (!inp) return;
    const isHidden = inp.type === 'password';
    inp.type = isHidden ? 'text' : 'password';
    const [showIcon, hideIcon] = btn.querySelectorAll('svg');
    if (showIcon) showIcon.style.display = isHidden ? 'none' : '';
    if (hideIcon) hideIcon.style.display = isHidden ? '' : 'none';
  });
}

/**
 * Sets a button to a loading state (disables it and shows spinner text).
 */
function setLoading(btn, loading, originalText) {
  btn.disabled = loading;
  btn.textContent = loading ? 'Loading…' : originalText;
}

/**
 * Formats a date string as "MMM D, YYYY"
 */
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

/**
 * Returns the user's initials from their name (e.g., "Alice Bose" → "AB")
 */
function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/**
 * Checks the /api/auth/me endpoint and returns { user } or null.
 * Used on page load to decide what to show in the navbar.
 */
async function getCurrentUser() {
  const { data } = await api.get('/api/auth/me');
  return data ? data.user : null;
}

/**
 * Renders the navbar based on whether the user is logged in.
 * Call this at the top of every page's JS file.
 */
async function renderNavbar() {
  // Ensure all navbar and footer brand elements display the logo
  document.querySelectorAll('.navbar-brand').forEach(brand => {
    if (!brand.querySelector('.navbar-logo')) {
      brand.innerHTML = `
        <img src="/assets/logo-icon.png" alt="DevConnect Logo" class="navbar-logo" />
        <span class="navbar-brand-text">DevConnect</span>
      `;
    }
  });

  document.querySelectorAll('.footer-brand').forEach(brand => {
    if (!brand.querySelector('.footer-logo')) {
      brand.innerHTML = `
        <img src="/assets/logo-icon.png" alt="DevConnect Logo" class="footer-logo" />
        <span class="footer-brand-text">DevConnect</span>
      `;
    }
  });

  const nav = document.getElementById('nav-links');
  if (!nav) return;
  const user = await getCurrentUser();

  if (user) {
    nav.innerHTML = `
      <a href="/discover.html?type=hackathon" class="navbar-nav-link"><span style="margin-right:5px;">🏆</span>Hackathons</a>
      <a href="/discover.html?type=regular" class="navbar-nav-link"><span style="margin-right:5px;">💻</span>Projects</a>
      <a href="/dashboard.html" class="navbar-nav-link">Dashboard</a>
      <a href="/profile.html" class="navbar-nav-link">Profile</a>
      <button class="btn btn-secondary btn-sm" id="logout-btn">Log out</button>
    `;
    document.getElementById('logout-btn').addEventListener('click', async () => {
      await api.post('/api/auth/logout');
      window.location.href = '/';
    });
  } else {
    nav.innerHTML = `
      <a href="/discover.html?type=hackathon" class="navbar-nav-link"><span style="margin-right:5px;">🏆</span>Hackathons</a>
      <a href="/discover.html?type=regular" class="navbar-nav-link"><span style="margin-right:5px;">💻</span>Projects</a>
      <a href="/#how-it-works" class="navbar-nav-link">How It Works</a>
      <a href="/login.html" class="navbar-nav-link">Login</a>
      <a href="/register.html" class="btn btn-primary btn-sm">Get Started</a>
    `;
  }

  // Wire mobile nav toggle
  const toggle = document.getElementById('mobile-menu-btn');
  const mobileNav = document.getElementById('mobile-nav');
  const backdrop = document.getElementById('mobile-backdrop');
  const closeBtn = document.getElementById('mobile-close');
  if (toggle && mobileNav) {
    // Populate mobile nav links
    const mobileLinks = document.getElementById('mobile-nav-links');
    if (mobileLinks) mobileLinks.innerHTML = nav.innerHTML;
    toggle.addEventListener('click', () => mobileNav.classList.add('open'));
    if (backdrop) backdrop.addEventListener('click', () => mobileNav.classList.remove('open'));
    if (closeBtn) closeBtn.addEventListener('click', () => mobileNav.classList.remove('open'));
  }

  return user;
}
