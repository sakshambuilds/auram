/**
 * Aura - Search & Notifications Slide-out Panels
 */
import { firebaseService } from './firebase-service.js';
import { state } from './state.js';

class SearchAndNotifications {
  constructor() {
    this.recentSearches = JSON.parse(localStorage.getItem('aura_recent_searches') || '[]');
    this.initListeners();
  }

  initListeners() {
    firebaseService.subscribe('NOTIFICATION_NEW', () => {
      this.updateUnreadBadge();
    });
  }

  // ==========================================
  // SEARCH DRAWER
  // ==========================================

  isSearchOpen() {
    const drawer = document.getElementById('search-drawer');
    return Boolean(drawer && drawer.classList.contains('active'));
  }

  toggleSearchDrawer() {
    if (this.isSearchOpen()) {
      this.closeSearchDrawer();
    } else {
      this.closeNotificationsDrawer();
      this.openSearchDrawer();
    }
  }

  openSearchDrawer() {
    const drawer = document.getElementById('search-drawer');
    if (!drawer) return;

    drawer.classList.add('active');
    firebaseService.syncAllData();
    const input = document.getElementById('search-drawer-input');
    if (input) {
      input.focus();
      this.renderRecentSearches();
    }
  }

  closeSearchDrawer() {
    const drawer = document.getElementById('search-drawer');
    if (drawer) drawer.classList.remove('active');
  }

  handleSearchInput(query) {
    const q = query.trim().toLowerCase();
    const resultsContainer = document.getElementById('search-results-list');
    if (!resultsContainer) return;

    if (!q) {
      this.renderRecentSearches();
      return;
    }

    const allUsers = firebaseService.getLocalUsers();
    const matchedUsers = allUsers.filter(u =>
      u.username.toLowerCase().includes(q) ||
      (u.displayName || '').toLowerCase().includes(q)
    );

    const allPosts = firebaseService.getLocalPosts();
    const matchedTags = new Set();
    allPosts.forEach(p => {
      const tags = (p.caption || '').match(/#([\w\u00A0-\uFFFF]+)/g) || [];
      tags.forEach(t => {
        if (t.toLowerCase().includes(q)) matchedTags.add(t);
      });
    });

    resultsContainer.innerHTML = '';

    // Hashtags section
    if (matchedTags.size > 0) {
      Array.from(matchedTags).forEach(tag => {
        const item = document.createElement('div');
        item.className = 'search-result-item tag-item';
        item.innerHTML = `
          <div class="search-tag-icon">#</div>
          <div class="search-tag-info">
            <span class="search-tag-name">${tag}</span>
            <span class="search-tag-sub">Tagged posts</span>
          </div>
        `;
        item.onclick = () => {
          this.addRecentSearch(tag);
          state.showToast(`Search for ${tag}`, 'info');
        };
        resultsContainer.appendChild(item);
      });
    }

    // Users section
    if (matchedUsers.length > 0) {
      matchedUsers.forEach(user => {
        const item = document.createElement('div');
        item.className = 'search-result-item user-item';
        item.innerHTML = `
          <img src="${user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`}" class="search-user-avatar" />
          <div class="search-user-info">
            <span class="search-user-name">${user.username}</span>
            <span class="search-user-sub">${user.displayName || ''}</span>
          </div>
        `;
        item.onclick = () => {
          this.addRecentSearch(user.username);
          this.closeSearchDrawer();
          state.setView('profile', { userId: user.uid });
        };
        resultsContainer.appendChild(item);
      });
    }

    if (matchedUsers.length === 0 && matchedTags.size === 0) {
      resultsContainer.innerHTML = '<div class="no-search-results">No results found.</div>';
    }
  }

  renderRecentSearches() {
    const resultsContainer = document.getElementById('search-results-list');
    if (!resultsContainer) return;

    if (this.recentSearches.length === 0) {
      resultsContainer.innerHTML = '<div class="no-recent-searches">No recent searches.</div>';
      return;
    }

    resultsContainer.innerHTML = `
      <div class="recent-header-row">
        <span>Recent</span>
        <button class="clear-all-recent-btn" id="clear-recent-searches">Clear all</button>
      </div>
      <div class="recent-items-list">
        ${this.recentSearches.map(s => `
          <div class="recent-item" data-term="${s}">
            <span>${s}</span>
            <button class="remove-recent-btn" data-term="${s}">✕</button>
          </div>
        `).join('')}
      </div>
    `;

    document.getElementById('clear-recent-searches')?.addEventListener('click', () => {
      this.recentSearches = [];
      localStorage.setItem('aura_recent_searches', JSON.stringify([]));
      this.renderRecentSearches();
    });

    resultsContainer.querySelectorAll('.recent-item').forEach(el => {
      el.onclick = (e) => {
        if (e.target.classList.contains('remove-recent-btn')) {
          e.stopPropagation();
          const term = e.target.dataset.term;
          this.recentSearches = this.recentSearches.filter(t => t !== term);
          localStorage.setItem('aura_recent_searches', JSON.stringify(this.recentSearches));
          this.renderRecentSearches();
          return;
        }
        const input = document.getElementById('search-drawer-input');
        if (input) {
          input.value = el.dataset.term;
          this.handleSearchInput(el.dataset.term);
        }
      };
    });
  }

  addRecentSearch(term) {
    this.recentSearches = [term, ...this.recentSearches.filter(t => t !== term)].slice(0, 10);
    localStorage.setItem('aura_recent_searches', JSON.stringify(this.recentSearches));
  }

  // ==========================================
  // NOTIFICATIONS DRAWER
  // ==========================================

  isNotificationsOpen() {
    const drawer = document.getElementById('notifications-drawer');
    return Boolean(drawer && drawer.classList.contains('active'));
  }

  toggleNotificationsDrawer() {
    if (this.isNotificationsOpen()) {
      this.closeNotificationsDrawer();
    } else {
      this.closeSearchDrawer();
      this.openNotificationsDrawer();
    }
  }

  openNotificationsDrawer() {
    const drawer = document.getElementById('notifications-drawer');
    if (!drawer) return;

    drawer.classList.add('active');
    this.renderNotifications();
    this.clearUnreadBadge();
  }

  closeNotificationsDrawer() {
    const drawer = document.getElementById('notifications-drawer');
    if (drawer) drawer.classList.remove('active');
  }

  renderNotifications() {
    const container = document.getElementById('notifications-list');
    if (!container || !state.currentUser) return;

    const notifs = firebaseService.getNotifications(state.currentUser.uid);

    if (notifs.length === 0) {
      container.innerHTML = `
        <div class="empty-notifs">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <p>No new notifications yet.</p>
        </div>
      `;
      return;
    }

    const allUsers = firebaseService.getLocalUsers();

    container.innerHTML = notifs.map(n => {
      const sender = allUsers.find(u => u.uid === n.senderId) || {
        username: 'someone',
        photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=user`
      };

      return `
        <div class="notif-item-row">
          <img src="${sender.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${sender.username}`}" class="notif-avatar" />
          <div class="notif-text-wrap">
            <span class="notif-text"><strong>${sender.username}</strong> ${n.text}</span>
            <span class="notif-time">${this.formatTimeAgo(n.timestamp)}</span>
          </div>
          ${n.type === 'follow' ? `
            <button class="aura-btn aura-btn-primary notif-action-btn" data-sender-id="${n.senderId}">Follow</button>
          ` : ''}
        </div>
      `;
    }).join('');

    container.querySelectorAll('.notif-action-btn').forEach(btn => {
      btn.onclick = async () => {
        const senderId = btn.dataset.senderId;
        const followed = await firebaseService.toggleFollow(state.currentUser.uid, senderId);
        btn.classList.toggle('aura-btn-primary', !followed);
        btn.classList.toggle('aura-btn-secondary', followed);
        btn.textContent = followed ? 'Following' : 'Follow';
      };
    });
  }

  updateUnreadBadge() {
    const badges = document.querySelectorAll('#notif-unread-badge, #mobile-notif-unread-badge');
    if (!state.currentUser) return;

    const notifs = firebaseService.getNotifications(state.currentUser.uid);
    const unread = notifs.filter(n => !n.read).length;

    badges.forEach(badge => {
      if (unread > 0) {
        badge.style.display = 'block';
        if (!badge.classList.contains('notif-dot')) {
          badge.textContent = unread > 9 ? '9+' : unread;
        }
      } else {
        badge.style.display = 'none';
      }
    });
  }

  clearUnreadBadge() {
    const badges = document.querySelectorAll('#notif-unread-badge, #mobile-notif-unread-badge');
    badges.forEach(b => b.style.display = 'none');

    if (state.currentUser) {
      const notifs = firebaseService.getLocalNotifications();
      notifs.forEach(n => {
        if (n.recipientId === state.currentUser.uid) n.read = true;
      });
      localStorage.setItem('aura_notifications', JSON.stringify(notifs));
    }
  }

  formatTimeAgo(timestamp) {
    const sec = Math.floor((Date.now() - timestamp) / 1000);
    if (sec < 60) return 'now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  }
}

export const searchAndNotifs = new SearchAndNotifications();
