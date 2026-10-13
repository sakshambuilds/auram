/**
 * Aura - Central State Management & Reactive Event Bus
 */

class AppState {
  constructor() {
    this.currentUser = null;
    this.currentView = 'feed';
    this.viewParams = {};
    this.posts = [];
    this.reels = [];
    this.stories = [];
    this.notifications = [];
    this.theme = localStorage.getItem('aura_theme') || 'dark';
    this.events = new Map();
  }

  // Event Subscription
  on(event, handler) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event).add(handler);
    return () => this.events.get(event)?.delete(handler);
  }

  // Event Trigger
  emit(event, data) {
    if (this.events.has(event)) {
      this.events.get(event).forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`[Aura Event Error: ${event}]`, err);
        }
      });
    }
  }

  setCurrentUser(user) {
    this.currentUser = user;
    this.emit('user:changed', user);
  }

  setView(viewName, params = {}) {
    this.currentView = viewName;
    this.viewParams = params;
    this.emit('view:changed', { view: viewName, params });
  }

  setTheme(theme) {
    this.theme = theme;
    localStorage.setItem('aura_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    this.updateBambooMenuLabels();
    this.emit('theme:changed', theme);
  }

  toggleTheme() {
    if (this.theme === 'bamboo') {
      this.setTheme('dark');
    } else {
      this.setTheme(this.theme === 'dark' ? 'light' : 'dark');
    }
  }

  toggleBambooTheme() {
    if (this.theme === 'bamboo') {
      const prev = localStorage.getItem('aura_prev_theme') || 'dark';
      this.setTheme(prev === 'bamboo' ? 'dark' : prev);
      this.showToast('Switched to default theme', 'info');
    } else {
      localStorage.setItem('aura_prev_theme', this.theme);
      this.setTheme('bamboo');
      this.showToast('🎋 Bamboo Theme activated!', 'success');
    }
  }

  updateBambooMenuLabels() {
    const isBamboo = this.theme === 'bamboo';
    const labels = document.querySelectorAll('#menu-bamboo-label, .menu-bamboo-text');
    labels.forEach(lbl => {
      lbl.textContent = isBamboo ? 'Change to Default theme' : 'Change to Bamboo theme';
    });
    const btns = document.querySelectorAll('#menu-toggle-bamboo, .menu-toggle-bamboo-btn');
    btns.forEach(btn => {
      btn.classList.toggle('bamboo-active', isBamboo);
    });
  }

  showToast(message, type = 'info', duration = 3200) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `aura-toast aura-toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    } else {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = `
      <span class="toast-icon">${iconSvg}</span>
      <span class="toast-msg">${message}</span>
    `;

    container.appendChild(toast);

    // Slide in
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 350);
    }, duration);
  }
}

export const state = new AppState();
