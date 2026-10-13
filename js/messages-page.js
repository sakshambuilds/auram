/**
 * Aura - Dedicated Direct Messages Page Controller
 * Powers messages.html with real-time DM chat, user filtering,
 * photo sharing via Cloudinary, and cross-device sync.
 */
import { firebaseService } from './firebase-service.js';
import { state } from './state.js';
import { directManager } from './ui-direct.js';
import { createStudio } from './ui-create.js';
import { searchAndNotifs } from './ui-search-notifications.js';

class MessagesPageController {
  constructor() {
    this.init();
  }

  async init() {
    // 1. Initialize Theme
    state.setTheme(state.theme);
    state.currentView = 'direct';

    // 2. Setup Controls
    this.setupNavigation();
    this.setupConversationFilter();
    this.setupModals();
    this.setupAuth();

    // 3. Listen to Auth State
    firebaseService.onAuthState(async (user) => {
      if (user) {
        state.setCurrentUser(user);
        this.showMainApp();
        this.updateUserUI(user);

        // Sync fresh messages from server
        await directManager.loadConversations(true);

        // Check if user was requested via query param (?user=uid or ?userId=uid)
        this.checkRequestedPartner();
      } else {
        const local = firebaseService.getLocalCurrentUser();
        if (local) {
          state.setCurrentUser(local);
          this.showMainApp();
          this.updateUserUI(local);
          await directManager.loadConversations(true);
          this.checkRequestedPartner();
        } else {
          this.showAuthScreen();
        }
      }
    });

    console.log('[Aura Messages] Standalone messages page initialized.');
  }

  showAuthScreen() {
    document.getElementById('auth-screen')?.classList.remove('hidden');
    document.getElementById('app-shell')?.classList.add('hidden');
  }

  showMainApp() {
    document.getElementById('auth-screen')?.classList.add('hidden');
    document.getElementById('app-shell')?.classList.remove('hidden');
  }

  updateUserUI(user) {
    const avatarEls = document.querySelectorAll('.sidebar-user-avatar, .mobile-user-avatar');
    avatarEls.forEach(img => {
      img.src = user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`;
    });

    const usernameEls = document.querySelectorAll('.current-user-username');
    usernameEls.forEach(el => {
      el.textContent = user.username;
    });
  }

  setupAuth() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        try {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Logging in...';
          await firebaseService.signIn(email, password);
        } catch (err) {
          state.showToast(err.message, 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Log In';
        }
      };
    }
  }

  setupNavigation() {
    // New Message Modal Trigger
    const newMsgBtn = document.getElementById('open-new-dm-btn');
    if (newMsgBtn) {
      newMsgBtn.onclick = (e) => {
        e.preventDefault();
        directManager.openNewMessageModal();
      };
    }

    // Search Drawer Toggles
    const toggleSearch = () => searchAndNotifs.toggleSearchDrawer();
    document.getElementById('sidebar-search-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleSearch();
    });
    document.getElementById('mobile-search-trigger')?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleSearch();
    });

    // Notifications Drawer Toggle
    const toggleNotif = () => searchAndNotifs.toggleNotificationsDrawer();
    document.getElementById('sidebar-notif-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleNotif();
    });

    // Drawer close buttons
    document.getElementById('search-drawer-close')?.addEventListener('click', () => {
      searchAndNotifs.closeSearchDrawer();
    });
    document.getElementById('notifications-drawer-close')?.addEventListener('click', () => {
      searchAndNotifs.closeNotificationsDrawer();
    });
    document.getElementById('search-drawer-input')?.addEventListener('input', (e) => {
      searchAndNotifs.handleSearchInput(e.target.value);
    });

    // Create Modal
    const openCreateModal = () => createStudio.openModal('post');
    document.getElementById('sidebar-create-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      openCreateModal();
    });
    document.getElementById('mobile-create-trigger')?.addEventListener('click', (e) => {
      e.preventDefault();
      openCreateModal();
    });

    // More popup menu
    const moreBtn = document.getElementById('sidebar-more-btn');
    const moreMenu = document.getElementById('more-popup-menu');
    if (moreBtn && moreMenu) {
      moreBtn.onclick = (e) => {
        e.preventDefault();
        moreMenu.classList.toggle('active');
      };
    }

    // Close drawers and more menu on outside click
    document.addEventListener('click', (e) => {
      const searchDrawer = document.getElementById('search-drawer');
      const notifDrawer = document.getElementById('notifications-drawer');
      const searchBtns = [
        document.getElementById('sidebar-search-btn'),
        document.getElementById('mobile-search-trigger')
      ];
      const notifBtns = [
        document.getElementById('sidebar-notif-btn')
      ];

      if (searchDrawer?.classList.contains('active') && !searchDrawer.contains(e.target) && !searchBtns.some(b => b?.contains(e.target))) {
        searchAndNotifs.closeSearchDrawer();
      }
      if (notifDrawer?.classList.contains('active') && !notifDrawer.contains(e.target) && !notifBtns.some(b => b?.contains(e.target))) {
        searchAndNotifs.closeNotificationsDrawer();
      }
      if (moreMenu?.classList.contains('active') && !moreMenu.contains(e.target) && !moreBtn?.contains(e.target)) {
        moreMenu.classList.remove('active');
      }
    });

    // Theme toggle & Logout
    document.getElementById('menu-toggle-bamboo')?.addEventListener('click', () => {
      state.toggleBambooTheme();
      moreMenu?.classList.remove('active');
    });

    document.getElementById('menu-toggle-theme')?.addEventListener('click', () => {
      state.toggleTheme();
      moreMenu?.classList.remove('active');
    });

    document.getElementById('menu-logout')?.addEventListener('click', async () => {
      await firebaseService.signOut();
      window.location.href = 'index.html';
    });
  }

  setupConversationFilter() {
    const filterInput = document.getElementById('direct-filter-input');
    if (!filterInput) return;

    filterInput.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      const listEl = document.getElementById('direct-conversations-list');
      if (!listEl) return;

      const items = listEl.querySelectorAll('.direct-conv-item');
      items.forEach(item => {
        const name = item.querySelector('.direct-conv-name')?.textContent.toLowerCase() || '';
        const msg = item.querySelector('.direct-conv-last-msg')?.textContent.toLowerCase() || '';
        if (name.includes(q) || msg.includes(q)) {
          item.style.display = 'flex';
        } else {
          item.style.display = 'none';
        }
      });
    });
  }

  setupModals() {
    document.querySelectorAll('.aura-modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
          document.body.classList.remove('modal-open');
        }
      });

      modal.querySelectorAll('.modal-close-trigger').forEach(btn => {
        btn.onclick = () => {
          modal.classList.remove('active');
          document.body.classList.remove('modal-open');
        };
      });
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.aura-modal.active').forEach(m => m.classList.remove('active'));
        document.body.classList.remove('modal-open');
        searchAndNotifs.closeSearchDrawer();
        searchAndNotifs.closeNotificationsDrawer();
      }
    });
  }

  async checkRequestedPartner() {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('user') || params.get('userId');
    const callType = params.get('call');
    if (userId) {
      await directManager.startChatWith(userId);
      if (callType === 'audio' || callType === 'video') {
        setTimeout(() => {
          directManager.openCallModal(callType);
        }, 350);
      }
    }
  }
}

new MessagesPageController();
