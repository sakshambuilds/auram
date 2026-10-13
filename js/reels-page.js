/**
 * Aura - Dedicated Standalone Reels Page Controller
 * Powers reels.html with vertical snap navigation, keyboard shortcuts,
 * sound management, camera launch, comments sheet & real-time sync.
 */
import { firebaseService } from './firebase-service.js';
import { state } from './state.js';
import { reelsManager } from './ui-reels.js';
import { createStudio } from './ui-create.js';
import { searchAndNotifs } from './ui-search-notifications.js';

class ReelsPageController {
  constructor() {
    this.init();
  }

  async init() {
    // 1. Initialize Theme
    state.setTheme(state.theme);
    state.currentView = 'reels';

    // 2. Setup Desktop & Mobile Controls
    this.setupReelsNav();
    this.setupKeyboardControls();
    this.setupTopHeaderControls();
    this.setupCommentsSheetEmojis();
    this.setupModals();
    this.setupAuth();

    // 3. Listen to Auth State
    firebaseService.onAuthState(async (user) => {
      if (user) {
        state.setCurrentUser(user);
        this.showMainApp();
        this.updateUserUI(user);

        // Load all reels from the shared real-time database
        await reelsManager.loadReels();

        // Check if a specific reel was requested via URL query (?reel=reel_id)
        this.scrollToRequestedReel();
      } else {
        // Fallback to locally remembered user if any
        const local = firebaseService.getLocalCurrentUser();
        if (local) {
          state.setCurrentUser(local);
          this.showMainApp();
          this.updateUserUI(local);
          await reelsManager.loadReels();
        } else {
          this.showAuthScreen();
        }
      }
    });

    // 4. Live update listener
    firebaseService.subscribe('REELS_UPDATED', (reels) => {
      reelsManager.reels = reels;
      reelsManager.renderReels();
    });

    console.log('[Aura Reels] Dedicated Reels page initialized.');
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

  setupReelsNav() {
    // Arrow Up / Down buttons
    const arrowUp = document.getElementById('reels-arrow-up');
    const arrowDown = document.getElementById('reels-arrow-down');
    const stage = document.getElementById('reels-page-stage');

    if (arrowUp && stage) {
      arrowUp.onclick = () => {
        stage.scrollBy({ top: -window.innerHeight * 0.85, behavior: 'smooth' });
      };
    }

    if (arrowDown && stage) {
      arrowDown.onclick = () => {
        stage.scrollBy({ top: window.innerHeight * 0.85, behavior: 'smooth' });
      };
    }

    // Sidebar & Mobile Search buttons (toggle behavior)
    const toggleSearch = () => searchAndNotifs.toggleSearchDrawer();
    document.getElementById('sidebar-search-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleSearch();
    });
    document.getElementById('mobile-search-trigger')?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleSearch();
    });

    // Sidebar & Mobile Notifications buttons (toggle behavior)
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

    // Close drawers when clicking outside
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
    });

    // When on reels.html, clicking Reels nav item scrolls smoothly to top
    const reelsNavBtns = document.querySelectorAll('a[href="reels.html"]');
    reelsNavBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        stage?.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    // Create buttons -> Open Create Reel Modal
    const openCreateReel = () => createStudio.openModal('reel');
    document.getElementById('sidebar-create-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      openCreateReel();
    });
    document.getElementById('mobile-create-trigger')?.addEventListener('click', (e) => {
      e.preventDefault();
      openCreateReel();
    });
    document.getElementById('reels-top-camera-btn')?.addEventListener('click', () => {
      openCreateReel();
    });

    // More popup menu
    const moreBtn = document.getElementById('sidebar-more-btn');
    const moreMenu = document.getElementById('more-popup-menu');
    if (moreBtn && moreMenu) {
      moreBtn.onclick = (e) => {
        e.preventDefault();
        moreMenu.classList.toggle('active');
      };
      document.addEventListener('click', (e) => {
        if (!moreBtn.contains(e.target) && !moreMenu.contains(e.target)) {
          moreMenu.classList.remove('active');
        }
      });
    }

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

  setupKeyboardControls() {
    const stage = document.getElementById('reels-page-stage');

    window.addEventListener('keydown', (e) => {
      // Ignore if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        stage?.scrollBy({ top: window.innerHeight * 0.85, behavior: 'smooth' });
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        stage?.scrollBy({ top: -window.innerHeight * 0.85, behavior: 'smooth' });
      } else if (e.key === ' ') {
        e.preventDefault();
        // Play / pause active video
        const activeVideo = this.getCurrentVisibleVideo();
        if (activeVideo) {
          if (activeVideo.paused) activeVideo.play();
          else activeVideo.pause();
        }
      } else if (e.key === 'm' || e.key === 'M') {
        this.toggleAllSound();
      }
    });
  }

  setupTopHeaderControls() {
    const soundBtn = document.getElementById('reels-top-sound-btn');
    if (soundBtn) {
      soundBtn.onclick = () => this.toggleAllSound();
    }
  }

  toggleAllSound() {
    reelsManager.isMuted = !reelsManager.isMuted;
    document.querySelectorAll('.reel-video').forEach(v => {
      v.muted = reelsManager.isMuted;
    });

    const soundBtn = document.getElementById('reels-top-sound-btn');
    if (soundBtn) {
      soundBtn.innerHTML = reelsManager.isMuted ? `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <line x1="23" y1="9" x2="17" y2="15"></line>
          <line x1="17" y1="9" x2="23" y2="15"></line>
        </svg>
      ` : `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>
      `;
    }

    state.showToast(reelsManager.isMuted ? 'Muted' : 'Sound on', 'info', 1200);
  }

  getCurrentVisibleVideo() {
    const cards = document.querySelectorAll('.aura-reel-card');
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (rect.top >= -100 && rect.top <= window.innerHeight / 2) {
        return card.querySelector('.reel-video');
      }
    }
    return document.querySelector('.reel-video');
  }

  setupCommentsSheetEmojis() {
    const emojis = document.querySelectorAll('.quick-emoji');
    const input = document.getElementById('reel-comment-input');
    emojis.forEach(em => {
      em.onclick = () => {
        if (input) {
          input.value += em.textContent;
          input.focus();
        }
      };
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
  }

  scrollToRequestedReel() {
    const params = new URLSearchParams(window.location.search);
    const reelId = params.get('reel');
    if (reelId) {
      setTimeout(() => {
        const target = document.querySelector(`[data-reel-id="${reelId}"]`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 400);
    }
  }
}

new ReelsPageController();
