/**
 * Aura - Application Bootstrapper & Main Controller
 */
import { firebaseService } from './firebase-service.js';
import { state } from './state.js';
import { feedManager } from './ui-feed.js';
import { storiesManager } from './ui-stories.js';
import { directManager } from './ui-direct.js';
import { profileManager } from './ui-profile.js';
import { createStudio } from './ui-create.js';
import { searchAndNotifs } from './ui-search-notifications.js';

class AuraApp {
  constructor() {
    this.init();
  }

  async init() {
    // 1. Initialize Theme
    state.setTheme(state.theme);

    // 2. Setup Global Listeners
    this.setupNavigation();
    this.setupAuthForms();
    this.setupModals();
    this.setupStoryViewerControls();

    // 3. Listen to Auth State
    firebaseService.onAuthState(async (user) => {
      if (user) {
        state.setCurrentUser(user);
        this.showMainApp();
        this.updateUserUI(user);
        
        // Initial data loads
        await Promise.all([
          feedManager.loadFeed(),
          storiesManager.loadStories()
        ]);
        searchAndNotifs.updateUnreadBadge();

        // Check URL parameters for direct view routing
        const urlParams = new URLSearchParams(window.location.search);
        const reqView = urlParams.get('view');
        const reqUserId = urlParams.get('userId');
        if (reqView === 'reels') {
          window.location.href = 'reels.html';
        } else if (reqView === 'direct' || reqView === 'messages') {
          window.location.href = reqUserId ? `messages.html?user=${reqUserId}` : 'messages.html';
        } else if (reqView === 'profile') {
          state.setView(reqView, { userId: reqUserId });
        }
      } else {
        state.setCurrentUser(null);
        this.showAuthScreen();
      }
    });

    // 4. View change listener
    state.on('view:changed', ({ view }) => {
      this.switchViewUI(view);
    });

    console.log('[Aura] Application successfully initialized.');
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
    // Update sidebar profile avatar and username
    const avatarEls = document.querySelectorAll('.sidebar-user-avatar, .mobile-user-avatar');
    avatarEls.forEach(img => {
      img.src = user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`;
    });

    const usernameEls = document.querySelectorAll('.current-user-username');
    usernameEls.forEach(el => {
      el.textContent = user.username;
    });
  }

  setupNavigation() {
    // Delegated click handling on document to capture 100% of nav clicks reliably
    document.addEventListener('click', (e) => {
      const navItem = e.target.closest('[data-nav]');

      // Outside click management for more popup menu and slide drawers
      if (!navItem) {
        const moreMenu = document.getElementById('more-popup-menu');
        const moreBtn = document.getElementById('sidebar-more-btn');
        if (moreMenu && moreMenu.classList.contains('active')) {
          if (!moreMenu.contains(e.target) && (!moreBtn || !moreBtn.contains(e.target))) {
            this.toggleMoreMenu(false);
          }
        }

        const searchDrawer = document.getElementById('search-drawer');
        const notifDrawer = document.getElementById('notifications-drawer');
        if (searchDrawer?.classList.contains('active') && !searchDrawer.contains(e.target)) {
          searchAndNotifs.closeSearchDrawer();
        }
        if (notifDrawer?.classList.contains('active') && !notifDrawer.contains(e.target)) {
          searchAndNotifs.closeNotificationsDrawer();
        }
        return;
      }

      const navTarget = navItem.dataset.nav;
      if (!navTarget) return;

      e.preventDefault();

      // Close More menu when any nav item other than 'more' is clicked
      if (navTarget !== 'more') {
        this.toggleMoreMenu(false);
      }

      if (navTarget === 'reels') {
        searchAndNotifs.closeSearchDrawer();
        searchAndNotifs.closeNotificationsDrawer();
        window.location.href = 'reels.html';
        return;
      }

      if (navTarget === 'messages' || navTarget === 'direct') {
        searchAndNotifs.closeSearchDrawer();
        searchAndNotifs.closeNotificationsDrawer();
        window.location.href = 'messages.html';
        return;
      }

      if (navTarget === 'search') {
        searchAndNotifs.toggleSearchDrawer();
        return;
      }

      if (navTarget === 'notifications') {
        searchAndNotifs.toggleNotificationsDrawer();
        return;
      }

      if (navTarget === 'create') {
        searchAndNotifs.closeSearchDrawer();
        searchAndNotifs.closeNotificationsDrawer();
        createStudio.openModal('post');
        return;
      }

      if (navTarget === 'more') {
        searchAndNotifs.closeSearchDrawer();
        searchAndNotifs.closeNotificationsDrawer();
        this.toggleMoreMenu();
        return;
      }

      // App Views: feed, direct, profile
      searchAndNotifs.closeSearchDrawer();
      searchAndNotifs.closeNotificationsDrawer();

      if (navTarget === 'feed' && state.currentView === 'feed') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      state.setView(navTarget);
    });

    // Search Drawer Input
    const searchInput = document.getElementById('search-drawer-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchAndNotifs.handleSearchInput(e.target.value);
      });
    }

    // Search Drawer Close
    document.getElementById('search-drawer-close')?.addEventListener('click', () => {
      searchAndNotifs.closeSearchDrawer();
    });

    // Notifications Drawer Close
    document.getElementById('notifications-drawer-close')?.addEventListener('click', () => {
      searchAndNotifs.closeNotificationsDrawer();
    });
  }

  switchViewUI(viewName) {
    if (viewName === 'reels') {
      window.location.href = 'reels.html';
      return;
    }
    if (viewName === 'direct' || viewName === 'messages') {
      window.location.href = 'messages.html';
      return;
    }

    // Update body state classes for responsive styles
    document.body.classList.remove('view-reels-active');
    document.body.classList.toggle('view-direct-active', viewName === 'direct');
    document.body.classList.toggle('view-profile-active', viewName === 'profile');
    document.body.classList.toggle('view-feed-active', viewName === 'feed');

    // Update navigation active states
    document.querySelectorAll('[data-nav]').forEach(item => {
      item.classList.toggle('active', item.dataset.nav === viewName);
    });

    // Toggle view containers
    const views = ['feed', 'direct', 'profile'];
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) {
        el.classList.toggle('active', v === viewName);
      }
    });

    // Reset scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  setupAuthForms() {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const toggleToSignup = document.getElementById('toggle-to-signup');
    const toggleToLogin = document.getElementById('toggle-to-login');

    // Toggle between login and signup
    if (toggleToSignup) {
      toggleToSignup.onclick = (e) => {
        e.preventDefault();
        document.getElementById('login-card').classList.add('hidden');
        document.getElementById('signup-card').classList.remove('hidden');
        document.getElementById('login-switch-prompt')?.classList.add('hidden');
        document.getElementById('signup-switch-prompt')?.classList.remove('hidden');
      };
    }

    if (toggleToLogin) {
      toggleToLogin.onclick = (e) => {
        e.preventDefault();
        document.getElementById('signup-card').classList.add('hidden');
        document.getElementById('login-card').classList.remove('hidden');
        document.getElementById('signup-switch-prompt')?.classList.add('hidden');
        document.getElementById('login-switch-prompt')?.classList.remove('hidden');
      };
    }

    // Sign In Submit
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
          state.showToast('Welcome back to Aura!', 'success');
        } catch (err) {
          state.showToast(err.message || 'Login failed', 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Log In';
        }
      };
    }

    // Sign Up Submit
    if (signupForm) {
      signupForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const username = document.getElementById('signup-username').value.trim();
        const fullname = document.getElementById('signup-fullname').value.trim();
        const submitBtn = signupForm.querySelector('button[type="submit"]');

        try {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Creating account...';
          await firebaseService.signUp(email, password, username, fullname);
          state.showToast(`Welcome to Aura, @${username}!`, 'success');
        } catch (err) {
          state.showToast(err.message || 'Sign up failed', 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Sign Up';
        }
      };
    }
  }

  setupModals() {
    // Backdrop click and close buttons for all modals
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

    // Escape Key to close modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.aura-modal.active').forEach(m => m.classList.remove('active'));
        document.body.classList.remove('modal-open');
        storiesManager.closeStoryViewer();
        searchAndNotifs.closeSearchDrawer();
        searchAndNotifs.closeNotificationsDrawer();
      }
    });

    // More dropdown menu handlers
    document.getElementById('menu-toggle-bamboo')?.addEventListener('click', () => {
      state.toggleBambooTheme();
      this.toggleMoreMenu(false);
    });

    document.getElementById('menu-toggle-theme')?.addEventListener('click', () => {
      state.toggleTheme();
      this.toggleMoreMenu(false);
      state.showToast(`Theme changed to ${state.theme} mode`, 'info', 1500);
    });

    document.getElementById('menu-logout')?.addEventListener('click', async () => {
      if (confirm('Log out of Aura?')) {
        await firebaseService.signOut();
        this.toggleMoreMenu(false);
        state.showToast('Logged out', 'info');
      }
    });
  }

  toggleMoreMenu(force = null) {
    const menu = document.getElementById('more-popup-menu');
    if (!menu) return;
    if (force !== null) {
      menu.classList.toggle('active', force);
    } else {
      menu.classList.toggle('active');
    }
  }

  setupStoryViewerControls() {
    const viewer = document.getElementById('story-viewer-modal');
    if (!viewer) return;

    // Tap zones: left 30% goes to previous story; right 70% goes to next
    const tapLeft = document.getElementById('story-tap-left');
    const tapRight = document.getElementById('story-tap-right');
    const closeBtn = document.getElementById('story-viewer-close');

    if (tapLeft) {
      tapLeft.onclick = () => storiesManager.prevStory();
    }
    if (tapRight) {
      tapRight.onclick = () => storiesManager.nextStory();
    }
    if (closeBtn) {
      closeBtn.onclick = () => storiesManager.closeStoryViewer();
    }

    // Press & Hold to pause
    const stage = document.getElementById('story-viewer-stage');
    if (stage) {
      stage.onmousedown = () => storiesManager.pauseStory();
      stage.onmouseup = () => storiesManager.resumeStory();
      stage.ontouchstart = () => storiesManager.pauseStory();
      stage.ontouchend = () => storiesManager.resumeStory();
    }

    // Quick emoji reactions
    document.querySelectorAll('.story-quick-react-btn').forEach(btn => {
      btn.onclick = () => {
        storiesManager.sendQuickReaction(btn.textContent.trim());
      };
    });
  }

  openNewMsg() {
    directManager.openNewMessageModal();
  }
}

// Bootstrap on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.Aura = new AuraApp();
});
