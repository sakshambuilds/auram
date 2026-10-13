/**
 * Aura - User Profile & Profile Editing System
 * Profile Stats, Posts Grid, Reels Grid, Saved Posts, Edit Profile Modal & Followers Modal
 */
import { firebaseService } from './firebase-service.js';
import { CloudinaryService } from './cloudinary-service.js';
import { state } from './state.js';
import { feedManager } from './ui-feed.js';
import { directManager } from './ui-direct.js';

class ProfileManager {
  constructor() {
    this.targetUserId = null;
    this.profileUser = null;
    this.activeTab = 'posts'; // 'posts' | 'reels' | 'saved'
    this.initListeners();
  }

  initListeners() {
    state.on('view:changed', ({ view, params }) => {
      if (view === 'profile') {
        this.targetUserId = params?.userId || state.currentUser?.uid;
        this.loadProfile();
      }
    });

    firebaseService.subscribe('USER_UPDATED', (user) => {
      if (this.targetUserId === user.uid) {
        this.profileUser = user;
        if (state.currentView === 'profile') this.renderProfile();
      }
    });

    firebaseService.subscribe('FOLLOW_UPDATED', (payload) => {
      const { me, target } = payload || {};
      if (me && state.currentUser && state.currentUser.uid === me.uid) {
        state.currentUser.following = me.following;
      }
      if (target && state.currentUser && state.currentUser.uid === target.uid) {
        state.currentUser.followers = target.followers;
      }
      if (this.profileUser) {
        if (target && this.profileUser.uid === target.uid) {
          this.profileUser.followers = target.followers;
        }
        if (me && this.profileUser.uid === me.uid) {
          this.profileUser.following = me.following;
        }
      }
      if (state.currentView === 'profile') {
        const followersCountEl = document.querySelector('#profile-followers-stat .stat-number');
        const followingCountEl = document.querySelector('#profile-following-stat .stat-number');
        if (followersCountEl && this.profileUser?.followers) {
          followersCountEl.textContent = this.profileUser.followers.length;
        }
        if (followingCountEl && this.profileUser?.following) {
          followingCountEl.textContent = this.profileUser.following.length;
        }
      }
    });

    firebaseService.subscribe('POSTS_UPDATED', () => {
      if (state.currentView === 'profile') this.renderProfile();
    });

    firebaseService.subscribe('REELS_UPDATED', () => {
      if (state.currentView === 'profile') this.renderProfile();
    });
  }

  async loadProfile() {
    if (!this.targetUserId) {
      if (state.currentUser) {
        this.targetUserId = state.currentUser.uid;
      } else {
        return;
      }
    }

    const profile = await firebaseService.getUserProfile(this.targetUserId);
    this.profileUser = profile || state.currentUser;
    this.renderProfile();
  }

  async renderProfile() {
    const container = document.getElementById('profile-view-container');
    if (!container || !this.profileUser) return;

    const isMe = state.currentUser && state.currentUser.uid === this.profileUser.uid;
    const isFollowing = state.currentUser && Array.isArray(state.currentUser.following) && state.currentUser.following.includes(this.profileUser.uid);

    const allPosts = await firebaseService.getPosts();
    const userPosts = allPosts.filter(p => p.userId === this.profileUser.uid);

    const allReels = await firebaseService.getReels();
    const userReels = allReels.filter(r => r.userId === this.profileUser.uid);

    const savedPosts = isMe ? allPosts.filter(p => Array.isArray(state.currentUser.savedPosts) && state.currentUser.savedPosts.includes(p.id)) : [];

    const followersCount = (this.profileUser.followers || []).length;
    const followingCount = (this.profileUser.following || []).length;

    container.innerHTML = `
      <div class="profile-layout-wrap">
        <!-- Mobile Profile Top Nav Bar -->
        <header class="mobile-profile-header-bar">
          <div class="mobile-prof-title-group">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            <span class="mobile-prof-username">${this.profileUser.username}</span>
            <svg class="brand-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
          <div class="mobile-prof-actions">
            ${isMe ? `
              <button class="mobile-prof-btn" id="mobile-prof-create-btn" aria-label="Create">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="5" ry="5"></rect>
                  <line x1="12" y1="8" x2="12" y2="16"></line>
                  <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
              </button>
              <button class="mobile-prof-btn" id="mobile-prof-menu-btn" aria-label="Menu">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>
            ` : ''}
          </div>
        </header>

        <!-- Profile Header -->
        <header class="profile-header">
          <div class="profile-avatar-column">
            <div class="profile-avatar-stage">
              <img src="${this.profileUser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${this.profileUser.username}`}" alt="${this.profileUser.username}" class="profile-avatar-img" />
            </div>
          </div>

          <div class="profile-details-column">
            <!-- Username & Actions Row -->
            <div class="profile-actions-row">
              <h2 class="profile-username-title">${this.profileUser.username}</h2>
              <div class="profile-buttons-group">
                ${isMe ? `
                  <button class="aura-btn aura-btn-secondary" id="edit-profile-btn">Edit profile</button>
                  <button class="aura-btn aura-btn-secondary" id="share-profile-btn">Share profile</button>
                  <button class="profile-gear-btn" id="profile-settings-btn" aria-label="Settings">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="3"></circle>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                  </button>
                ` : `
                  <button class="aura-btn ${isFollowing ? 'aura-btn-secondary' : 'aura-btn-primary'}" id="profile-follow-btn">
                    ${isFollowing ? 'Following' : 'Follow'}
                  </button>
                  <button class="aura-btn aura-btn-secondary" id="profile-message-btn">Message</button>
                  <button class="aura-btn aura-btn-secondary profile-call-icon-btn" id="profile-call-btn" title="Audio Call @${this.profileUser.username}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                  </button>
                  <button class="aura-btn aura-btn-secondary profile-call-icon-btn" id="profile-videocall-btn" title="Video Call @${this.profileUser.username}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polygon points="23 7 16 12 23 17 23 7"></polygon>
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                    </svg>
                  </button>
                `}
              </div>
            </div>

            <!-- Stats Row -->
            <div class="profile-stats-row">
              <div class="stat-item"><span class="stat-number">${userPosts.length}</span> posts</div>
              <div class="stat-item clickable" id="profile-followers-stat"><span class="stat-number">${followersCount}</span> followers</div>
              <div class="stat-item clickable" id="profile-following-stat"><span class="stat-number">${followingCount}</span> following</div>
            </div>

            <!-- Bio / Info -->
            <div class="profile-bio-box">
              <span class="profile-display-name">${this.profileUser.displayName || this.profileUser.username}</span>
              <span class="profile-category-tag">Digital creator</span>
              <p class="profile-bio-text">${this.escapeHTML(this.profileUser.bio || '✨ Aura Creator')}</p>
              ${this.profileUser.website ? `
                <a href="${this.profileUser.website.startsWith('http') ? this.profileUser.website : 'https://' + this.profileUser.website}" target="_blank" rel="noopener noreferrer" class="profile-website-link">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                  </svg>
                  ${this.profileUser.website.replace(/^https?:\/\//, '')}
                </a>
              ` : ''}
            </div>
          </div>
        </header>

        <!-- Highlights Row -->
        <div class="profile-highlights-row">
          <div class="highlight-bubble-wrap">
            <div class="highlight-bubble">
              <span>✨</span>
            </div>
            <span class="highlight-title">Moments</span>
          </div>
          ${isMe ? `
            <div class="highlight-bubble-wrap" id="add-highlight-btn">
              <div class="highlight-bubble add-highlight">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </div>
              <span class="highlight-title">New</span>
            </div>
          ` : ''}
        </div>

        <!-- Navigation Tabs -->
        <div class="profile-tabs-bar">
          <button class="profile-nav-tab ${this.activeTab === 'posts' ? 'active' : ''}" data-tab="posts">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            POSTS
          </button>
          <button class="profile-nav-tab ${this.activeTab === 'reels' ? 'active' : ''}" data-tab="reels">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="23 7 16 12 23 17 23 7"></polygon>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
            REELS
          </button>
          ${isMe ? `
            <button class="profile-nav-tab ${this.activeTab === 'saved' ? 'active' : ''}" data-tab="saved">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
              </svg>
              SAVED
            </button>
          ` : ''}
        </div>

        <!-- Tab Content Grid -->
        <div class="profile-content-grid" id="profile-grid">
          ${this.renderActiveGrid({ userPosts, userReels, savedPosts, isMe })}
        </div>
      </div>
    `;

    // Attach profile event handlers
    this.attachProfileEvents({ isMe, isFollowing, userPosts, userReels, savedPosts });
  }

  renderActiveGrid({ userPosts, userReels, savedPosts, isMe }) {
    if (this.activeTab === 'posts') {
      if (userPosts.length === 0) {
        return `
          <div class="empty-profile-tab">
            <div class="empty-tab-icon">📷</div>
            <h3>Share Photos</h3>
            <p>When you share photos, they will appear on your profile.</p>
          </div>
        `;
      }
      return userPosts.map(p => {
        const isVideo = p.mediaType === 'video' || (p.mediaUrl && p.mediaUrl.match(/\.(mp4|webm|mov)(\?.*)?$/i));
        return `
          <div class="profile-grid-tile" data-post-id="${p.id}">
            ${isVideo ? `
              <video src="${p.mediaUrl}" muted preload="metadata"></video>
              <div class="tile-video-indicator">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>
              </div>
            ` : `
              <img src="${p.mediaUrl}" loading="lazy" />
            `}
            ${isMe ? `
              <button class="tile-quick-delete-btn" data-delete-post="${p.id}" title="Delete Post">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            ` : ''}
            <div class="grid-hover-overlay">
              <span>❤️ ${(p.likes || []).length}</span>
              <span>💬 ${(p.comments || []).length}</span>
            </div>
          </div>
        `;
      }).join('');
    } else if (this.activeTab === 'reels') {
      if (userReels.length === 0) {
        return `
          <div class="empty-profile-tab">
            <div class="empty-tab-icon">🎬</div>
            <h3>Capture and Share Moments</h3>
            <p>Share your favorite short-form videos with Aura Reels.</p>
          </div>
        `;
      }
      return userReels.map(r => `
        <div class="profile-grid-tile reel-tile" data-reel-id="${r.id}">
          <video src="${r.videoUrl}" muted preload="metadata"></video>
          <div class="tile-video-indicator">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="2.5" y="2.5" width="19" height="19" rx="5"></rect><polygon points="10 12 15 15 10 18" fill="white"></polygon></svg>
          </div>
          ${isMe ? `
            <button class="tile-quick-delete-btn" data-delete-reel="${r.id}" title="Delete Reel">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          ` : ''}
          <div class="grid-hover-overlay">
            <span>❤️ ${(r.likes || []).length}</span>
            <span>💬 ${(r.comments || []).length}</span>
          </div>
        </div>
      `).join('');
    } else if (this.activeTab === 'saved') {
      if (savedPosts.length === 0) {
        return `
          <div class="empty-profile-tab">
            <div class="empty-tab-icon">🔖</div>
            <h3>Save Posts</h3>
            <p>Save photos and videos that you want to see again.</p>
          </div>
        `;
      }
      return savedPosts.map(p => `
        <div class="profile-grid-tile" data-post-id="${p.id}">
          <img src="${p.mediaUrl}" loading="lazy" />
          <div class="grid-hover-overlay">
            <span>❤️ ${(p.likes || []).length}</span>
            <span>💬 ${(p.comments || []).length}</span>
          </div>
        </div>
      `).join('');
    }
    return '';
  }

  attachProfileEvents({ isMe, isFollowing, userPosts, userReels, savedPosts }) {
    // Tabs
    const tabBtns = document.querySelectorAll('.profile-nav-tab');
    tabBtns.forEach(btn => {
      btn.onclick = () => {
        this.activeTab = btn.dataset.tab;
        this.renderProfile();
      };
    });

    // Mobile Top Bar buttons
    const mobileCreateBtn = document.getElementById('mobile-prof-create-btn');
    if (mobileCreateBtn) {
      mobileCreateBtn.onclick = () => state.emit('open:create-modal', { mode: 'post' });
    }
    const mobileMenuBtn = document.getElementById('mobile-prof-menu-btn');
    if (mobileMenuBtn) {
      mobileMenuBtn.onclick = () => this.openProfileSettingsSheet();
    }
    const profileSettingsBtn = document.getElementById('profile-settings-btn');
    if (profileSettingsBtn) {
      profileSettingsBtn.onclick = () => this.openProfileSettingsSheet();
    }

    // Quick delete buttons for own posts & reels
    const deleteBtns = document.querySelectorAll('.tile-quick-delete-btn');
    deleteBtns.forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation(); // Don't trigger tile click to open modal/page
        const deletePostId = btn.dataset.deletePost;
        const deleteReelId = btn.dataset.deleteReel;
        if (deletePostId) {
          const postToDelete = userPosts.find(p => p.id === deletePostId);
          if (postToDelete && (!state.currentUser || postToDelete.userId !== state.currentUser.uid)) {
            state.showToast("You cannot delete another person's post", 'error');
            return;
          }
          if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) return;
          try {
            btn.innerHTML = '⏳';
            await firebaseService.deletePost(deletePostId, state.currentUser.uid);
            state.showToast('Post deleted', 'info');
            await this.renderProfile();
          } catch (err) {
            console.error('Delete post error:', err);
            state.showToast(err.message || 'Failed to delete post', 'error');
            await this.renderProfile();
          }
        } else if (deleteReelId) {
          const reelToDelete = userReels.find(r => r.id === deleteReelId);
          if (reelToDelete && (!state.currentUser || reelToDelete.userId !== state.currentUser.uid)) {
            state.showToast("You cannot delete another person's reel", 'error');
            return;
          }
          if (!confirm('Are you sure you want to delete this reel? This action cannot be undone.')) return;
          try {
            btn.innerHTML = '⏳';
            await firebaseService.deleteReel(deleteReelId, state.currentUser.uid);
            state.showToast('Reel deleted', 'info');
            await this.renderProfile();
          } catch (err) {
            console.error('Delete reel error:', err);
            state.showToast(err.message || 'Failed to delete reel', 'error');
            await this.renderProfile();
          }
        }
      };
    });

    // Tile click -> Open post detail or reel
    const tiles = document.querySelectorAll('.profile-grid-tile');
    tiles.forEach(tile => {
      tile.onclick = () => {
        const postId = tile.dataset.postId;
        const reelId = tile.dataset.reelId;
        if (postId) {
          const post = [...userPosts, ...savedPosts].find(p => p.id === postId);
          if (post) feedManager.openCommentsModal(post);
        } else if (reelId) {
          window.location.href = `reels.html?reel=${reelId}`;
        }
      };
    });

    // Edit Profile Modal
    const editBtn = document.getElementById('edit-profile-btn');
    if (editBtn) {
      editBtn.onclick = () => this.openEditProfileModal();
    }

    // Share Profile
    const shareBtn = document.getElementById('share-profile-btn');
    if (shareBtn) {
      shareBtn.onclick = () => {
        navigator.clipboard.writeText(window.location.origin + '?u=' + this.profileUser.username);
        state.showToast('Profile link copied!', 'success');
      };
    }

    // Follow Button
    const followBtn = document.getElementById('profile-follow-btn');
    if (followBtn) {
      followBtn.onclick = async () => {
        if (!state.currentUser) return;
        const followed = await firebaseService.toggleFollow(state.currentUser.uid, this.profileUser.uid);
        
        if (!Array.isArray(state.currentUser.following)) state.currentUser.following = [];
        if (!Array.isArray(this.profileUser.followers)) this.profileUser.followers = [];

        if (followed) {
          if (!state.currentUser.following.includes(this.profileUser.uid)) {
            state.currentUser.following.push(this.profileUser.uid);
          }
          if (!this.profileUser.followers.includes(state.currentUser.uid)) {
            this.profileUser.followers.push(state.currentUser.uid);
          }
        } else {
          state.currentUser.following = state.currentUser.following.filter(id => id !== this.profileUser.uid);
          this.profileUser.followers = this.profileUser.followers.filter(id => id !== state.currentUser.uid);
        }

        followBtn.classList.toggle('aura-btn-primary', !followed);
        followBtn.classList.toggle('aura-btn-secondary', followed);
        followBtn.textContent = followed ? 'Following' : 'Follow';

        const followersCountEl = document.querySelector('#profile-followers-stat .stat-number');
        if (followersCountEl && this.profileUser.followers) {
          followersCountEl.textContent = this.profileUser.followers.length;
        }

        state.showToast(followed ? `Following @${this.profileUser.username}` : `Unfollowed @${this.profileUser.username}`, 'info');
      };
    }

    // Message Button
    const msgBtn = document.getElementById('profile-message-btn');
    if (msgBtn) {
      msgBtn.onclick = () => {
        window.location.href = `messages.html?user=${this.profileUser.uid}`;
      };
    }

    // Direct Call Buttons from Profile
    const profileCallBtn = document.getElementById('profile-call-btn');
    if (profileCallBtn) {
      profileCallBtn.onclick = () => {
        directManager.openCallModal('audio', this.profileUser);
      };
    }
    const profileVideoCallBtn = document.getElementById('profile-videocall-btn');
    if (profileVideoCallBtn) {
      profileVideoCallBtn.onclick = () => {
        directManager.openCallModal('video', this.profileUser);
      };
    }

    // Followers & Following lists click
    const followersStat = document.getElementById('profile-followers-stat');
    const followingStat = document.getElementById('profile-following-stat');
    if (followersStat) followersStat.onclick = () => this.openFollowersModal('followers');
    if (followingStat) followingStat.onclick = () => this.openFollowersModal('following');
  }

  openProfileSettingsSheet() {
    const modal = document.getElementById('options-modal');
    const list = document.getElementById('options-modal-list');
    if (!modal || !list) {
      this.openEditProfileModal();
      return;
    }

    const isBamboo = state.theme === 'bamboo';
    list.innerHTML = `
      <button class="opt-btn" id="prof-opt-bamboo" style="font-weight:600; color:var(--accent-color);">
        🎋 ${isBamboo ? 'Change to Default theme' : 'Change to Bamboo theme'}
      </button>
      <button class="opt-btn" id="prof-opt-appearance">
        🌓 Switch Appearance
      </button>
      <button class="opt-btn" id="prof-opt-edit">
        ⚙️ Edit Profile
      </button>
      <button class="opt-btn opt-danger" id="prof-opt-logout">
        Log Out
      </button>
      <button class="opt-btn opt-cancel" id="prof-opt-cancel">
        Cancel
      </button>
    `;

    modal.classList.add('active');

    document.getElementById('prof-opt-bamboo').onclick = () => {
      modal.classList.remove('active');
      state.toggleBambooTheme();
    };

    document.getElementById('prof-opt-appearance').onclick = () => {
      modal.classList.remove('active');
      state.toggleTheme();
      state.showToast(`Theme changed to ${state.theme} mode`, 'info');
    };

    document.getElementById('prof-opt-edit').onclick = () => {
      modal.classList.remove('active');
      this.openEditProfileModal();
    };

    document.getElementById('prof-opt-logout').onclick = async () => {
      modal.classList.remove('active');
      if (confirm('Log out of Aura?')) {
        await firebaseService.signOut();
        state.showToast('Logged out', 'info');
      }
    };

    document.getElementById('prof-opt-cancel').onclick = () => {
      modal.classList.remove('active');
    };
  }

  openEditProfileModal() {
    const modal = document.getElementById('edit-profile-modal');
    if (!modal || !state.currentUser) return;

    modal.classList.add('active');

    const avatarEl = document.getElementById('edit-prof-avatar');
    const nameInput = document.getElementById('edit-prof-name');
    const usernameInput = document.getElementById('edit-prof-username');
    const bioInput = document.getElementById('edit-prof-bio');
    const websiteInput = document.getElementById('edit-prof-website');
    const photoFileInput = document.getElementById('edit-prof-file');
    const form = document.getElementById('edit-profile-form');
    const closeBtn = document.getElementById('edit-profile-close');
    const charCounter = document.getElementById('edit-bio-count');

    if (avatarEl) avatarEl.src = state.currentUser.photoURL || '';
    if (nameInput) nameInput.value = state.currentUser.displayName || '';
    if (usernameInput) usernameInput.value = state.currentUser.username || '';
    if (bioInput) {
      bioInput.value = state.currentUser.bio || '';
      if (charCounter) charCounter.textContent = `${bioInput.value.length}/150`;
      bioInput.oninput = () => {
        if (charCounter) charCounter.textContent = `${bioInput.value.length}/150`;
      };
    }
    if (websiteInput) websiteInput.value = state.currentUser.website || '';

    // Handle photo change via Cloudinary
    let pendingAvatarUrl = null;
    photoFileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      state.showToast('Uploading new profile photo...', 'info');
      try {
        const upload = await CloudinaryService.uploadMedia(file, 'image');
        pendingAvatarUrl = upload.secure_url;
        if (avatarEl) avatarEl.src = upload.secure_url;
        state.showToast('Photo uploaded! Click save to apply.', 'success');
      } catch (err) {
        state.showToast('Upload failed: ' + err.message, 'error');
      }
    };

    // Save profile form
    form.onsubmit = async (e) => {
      e.preventDefault();
      const updates = {
        displayName: nameInput.value.trim(),
        username: usernameInput.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''),
        bio: bioInput.value.trim(),
        website: websiteInput.value.trim()
      };

      if (pendingAvatarUrl) {
        updates.photoURL = pendingAvatarUrl;
      }

      state.showToast('Saving profile...', 'info');
      const updatedUser = await firebaseService.updateUserProfile(state.currentUser.uid, updates);
      state.setCurrentUser(updatedUser);
      modal.classList.remove('active');
      state.showToast('Profile updated successfully!', 'success');
    };

    if (closeBtn) closeBtn.onclick = () => modal.classList.remove('active');
  }

  async openFollowersModal(tab = 'followers') {
    const modal = document.getElementById('followers-modal');
    const title = document.getElementById('followers-modal-title');
    const list = document.getElementById('followers-modal-list');
    const closeBtn = document.getElementById('followers-modal-close');
    if (!modal || !list) return;

    modal.classList.add('active');
    if (title) title.textContent = tab === 'followers' ? 'Followers' : 'Following';

    const uids = tab === 'followers' ? (this.profileUser.followers || []) : (this.profileUser.following || []);
    const allUsers = firebaseService.getLocalUsers();

    const listUsers = uids.map(id => allUsers.find(u => u.uid === id) || { uid: id, username: 'user_' + id.slice(0, 5) });

    if (listUsers.length === 0) {
      list.innerHTML = `<div class="no-users-list">No ${tab} yet.</div>`;
      return;
    }

    list.innerHTML = listUsers.map(u => `
      <div class="user-row-item">
        <div class="user-row-left">
          <img src="${u.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${u.username}`}" class="user-row-avatar" />
          <div class="user-row-meta">
            <span class="user-row-username">${u.username}</span>
            <span class="user-row-name">${u.displayName || ''}</span>
          </div>
        </div>
      </div>
    `).join('');

    if (closeBtn) closeBtn.onclick = () => modal.classList.remove('active');
  }

  escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }
}

export const profileManager = new ProfileManager();
