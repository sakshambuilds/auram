/**
 * Aura - Instagram Reels System
 * Vertical Snap-Scroll Video Player, Auto-playback, Sound Toggle, Floating Actions
 */
import { firebaseService } from './firebase-service.js';
import { state } from './state.js';

class ReelsManager {
  constructor() {
    this.reels = [];
    this.observer = null;
    this.isMuted = false;
    this.initListeners();
  }

  initListeners() {
    firebaseService.subscribe('REELS_UPDATED', (reels) => {
      this.reels = reels;
      if (state.currentView === 'reels') {
        this.renderReels();
      }
    });

    state.on('view:changed', ({ view }) => {
      if (view === 'reels') {
        this.loadReels();
      } else {
        this.pauseAllVideos();
      }
    });
  }

  async loadReels() {
    const reels = await firebaseService.getReels();
    this.reels = reels;
    this.renderReels();
  }

  pauseAllVideos() {
    const videos = document.querySelectorAll('.reel-video');
    videos.forEach(v => {
      v.pause();
    });
  }

  renderReels() {
    const container = document.getElementById('reels-container');
    if (!container) return;

    if (this.reels.length === 0) {
      container.innerHTML = `
        <div class="empty-reels-card">
          <div class="empty-icon-wrap">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
              <polygon points="10 8 16 12 10 16 10 8"></polygon>
            </svg>
          </div>
          <h3>Watch and Share Reels</h3>
          <p>Immersive full-screen short videos with music, filters, and audio.</p>
          <button class="aura-btn aura-btn-primary" id="empty-reels-create-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="23 7 16 12 23 17 23 7"></polygon>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
            Record or Upload Reel
          </button>
        </div>
      `;

      const createBtn = document.getElementById('empty-reels-create-btn');
      if (createBtn) {
        createBtn.onclick = () => state.emit('open:create-modal', { mode: 'reel' });
      }
      return;
    }

    container.innerHTML = '';
    const currentUser = state.currentUser;

    this.reels.forEach(reel => {
      const isLiked = currentUser && Array.isArray(reel.likes) && reel.likes.includes(currentUser.uid);
      const isFollowing = currentUser && Array.isArray(currentUser.following) && currentUser.following.includes(reel.userId);
      const isOwner = currentUser && currentUser.uid === reel.userId;

      const reelEl = document.createElement('div');
      reelEl.className = 'aura-reel-card';
      reelEl.dataset.reelId = reel.id;

      reelEl.innerHTML = `
        <div class="reel-video-wrapper">
          <video class="reel-video" src="${reel.videoUrl}" loop playsinline preload="auto"></video>
          
          <!-- Tap Pause/Play Overlay -->
          <div class="reel-playback-indicator">
            <svg class="indicator-play" width="48" height="48" viewBox="0 0 24 24" fill="white">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </div>

          <!-- Bottom Progress Bar -->
          <div class="reel-progress-track">
            <div class="reel-progress-bar"></div>
          </div>

          <!-- Right Floating Action Column -->
          <div class="reel-actions-column">
            <!-- Like -->
            <button class="reel-action-btn reel-like-btn ${isLiked ? 'liked' : ''}" data-reel-id="${reel.id}">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="${isLiked ? '#ff3040' : 'none'}" stroke="${isLiked ? '#ff3040' : 'white'}" stroke-width="2">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
              </svg>
              <span class="reel-stat-count">${(reel.likes || []).length}</span>
            </button>

            <!-- Comment -->
            <button class="reel-action-btn reel-comment-btn" data-reel-id="${reel.id}">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
              </svg>
              <span class="reel-stat-count">${(reel.comments || []).length}</span>
            </button>

            <!-- Share -->
            <button class="reel-action-btn reel-share-btn" data-reel-id="${reel.id}">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>

            <!-- Mute Toggle -->
            <button class="reel-action-btn reel-mute-btn">
              <svg class="reel-sound-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
            </button>

            <!-- Options / More Button (...) -->
            <button class="reel-action-btn reel-options-btn" data-reel-id="${reel.id}" aria-label="More options">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="2"></circle>
                <circle cx="19" cy="12" r="2"></circle>
                <circle cx="5" cy="12" r="2"></circle>
              </svg>
            </button>

            <!-- Spinning Vinyl Disc -->
            <div class="reel-audio-disc">
              <img src="${reel.userPhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${reel.username}`}" class="disc-cover" />
            </div>
          </div>

          <!-- Bottom Content Info -->
          <div class="reel-bottom-info">
            <div class="reel-author-row">
              <img src="${reel.userPhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${reel.username}`}" class="reel-author-avatar" />
              <span class="reel-author-username">${reel.username}</span>
              ${!isOwner ? `
                <button class="reel-follow-btn ${isFollowing ? 'following' : ''}" data-user-id="${reel.userId}">
                  ${isFollowing ? 'Following' : 'Follow'}
                </button>
              ` : ''}
            </div>

            <div class="reel-caption-wrap">
              <span class="reel-caption">${this.escapeHTML(reel.caption || '')}</span>
            </div>

            <div class="reel-audio-ticker">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
              </svg>
              <div class="marquee-track">
                <span>${reel.audioName || `Original audio - ${reel.username}`}</span>
              </div>
            </div>
          </div>
        </div>
      `;

      this.attachReelEvents(reelEl, reel);
      container.appendChild(reelEl);
    });

    this.setupIntersectionObserver();
  }

  attachReelEvents(reelEl, reel) {
    const video = reelEl.querySelector('.reel-video');
    const indicator = reelEl.querySelector('.reel-playback-indicator');
    const progressBar = reelEl.querySelector('.reel-progress-bar');
    const likeBtn = reelEl.querySelector('.reel-like-btn');
    const likeCount = likeBtn.querySelector('.reel-stat-count');
    const commentBtn = reelEl.querySelector('.reel-comment-btn');
    const shareBtn = reelEl.querySelector('.reel-share-btn');
    const muteBtn = reelEl.querySelector('.reel-mute-btn');
    const followBtn = reelEl.querySelector('.reel-follow-btn');
    const authorClickables = reelEl.querySelectorAll('.reel-author-avatar, .reel-author-username');

    // Mute state
    video.muted = this.isMuted;

    // Progress updater
    video.ontimeupdate = () => {
      if (video.duration) {
        const percent = (video.currentTime / video.duration) * 100;
        progressBar.style.width = `${percent}%`;
      }
    };

    // Tap to pause/play
    video.addEventListener('click', () => {
      if (video.paused) {
        video.play();
        indicator.classList.remove('show');
      } else {
        video.pause();
        indicator.classList.add('show');
      }
    });

    // Mute Button
    muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isMuted = !this.isMuted;
      document.querySelectorAll('.reel-video').forEach(v => {
        v.muted = this.isMuted;
      });
      state.showToast(this.isMuted ? 'Muted' : 'Sound on', 'info', 1500);
    });

    // Like Reel
    likeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!state.currentUser) return;
      const res = await firebaseService.toggleLikeReel(reel.id, state.currentUser.uid);
      if (res) {
        likeBtn.classList.toggle('liked', res.liked);
        likeBtn.querySelector('svg').setAttribute('fill', res.liked ? '#ff3040' : 'none');
        likeBtn.querySelector('svg').setAttribute('stroke', res.liked ? '#ff3040' : 'white');
        likeCount.textContent = res.count;
      }
    });

    // Comment Reel
    commentBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openReelComments(reel);
    });

    // Share Reel
    shareBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(window.location.origin + '?reel=' + reel.id);
      state.showToast('Reel link copied to clipboard!', 'success');
    });

    // Options Reel (...)
    const optionsBtn = reelEl.querySelector('.reel-options-btn');
    if (optionsBtn) {
      optionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openReelOptionsMenu(reel, reelEl);
      });
    }

    // Follow Button
    if (followBtn) {
      followBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!state.currentUser) return;
        const followed = await firebaseService.toggleFollow(state.currentUser.uid, reel.userId);
        followBtn.classList.toggle('following', followed);
        followBtn.textContent = followed ? 'Following' : 'Follow';
        state.showToast(followed ? `Following @${reel.username}` : `Unfollowed @${reel.username}`, 'info');
      });
    }

    // Author Profile Click
    authorClickables.forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        state.setView('profile', { userId: reel.userId });
      });
    });
  }

  openReelOptionsMenu(reel, reelEl) {
    const isOwner = state.currentUser && state.currentUser.uid === reel.userId;
    const modal = document.getElementById('options-modal');
    const list = document.getElementById('options-modal-list');
    if (!modal || !list) return;

    list.innerHTML = `
      ${isOwner ? '<button class="opt-btn opt-danger" id="opt-delete-reel">Delete Reel</button>' : ''}
      <button class="opt-btn" id="opt-copy-reel-link">Copy link</button>
      <button class="opt-btn" id="opt-share-reel">Share</button>
      <button class="opt-btn opt-cancel" id="opt-cancel-reel">Cancel</button>
    `;

    modal.classList.add('active');

    const delBtn = document.getElementById('opt-delete-reel');
    if (delBtn) {
      delBtn.onclick = async () => {
        modal.classList.remove('active');
        if (!state.currentUser || state.currentUser.uid !== reel.userId) {
          state.showToast("You cannot delete another person's reel", 'error');
          return;
        }
        if (confirm('Delete this reel? This action cannot be undone.')) {
          try {
            await firebaseService.deleteReel(reel.id, state.currentUser.uid);
            state.showToast('Reel deleted', 'info');
            if (reelEl) reelEl.remove();
            this.reels = this.reels.filter(r => r.id !== reel.id);
            if (this.reels.length === 0) {
              this.renderReels();
            }
          } catch (err) {
            state.showToast(err.message || 'Failed to delete reel', 'error');
          }
        }
      };
    }

    const copyBtn = document.getElementById('opt-copy-reel-link');
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(window.location.origin + '?reel=' + reel.id);
        state.showToast('Reel link copied!', 'success');
        modal.classList.remove('active');
      };
    }

    const shareBtn = document.getElementById('opt-share-reel');
    if (shareBtn) {
      shareBtn.onclick = () => {
        navigator.clipboard.writeText(window.location.origin + '?reel=' + reel.id);
        state.showToast('Reel link copied to share!', 'success');
        modal.classList.remove('active');
      };
    }

    const cancelBtn = document.getElementById('opt-cancel-reel');
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        modal.classList.remove('active');
      };
    }
  }

  setupIntersectionObserver() {
    if (this.observer) this.observer.disconnect();

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const video = entry.target.querySelector('.reel-video');
        if (!video) return;

        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    }, { threshold: [0.6] });

    document.querySelectorAll('.aura-reel-card').forEach(card => {
      this.observer.observe(card);
    });
  }

  openReelComments(reel) {
    const sheet = document.getElementById('reel-comments-sheet');
    const list = document.getElementById('reel-comments-list');
    const form = document.getElementById('reel-comment-form');
    const input = document.getElementById('reel-comment-input');
    if (!sheet || !list) return;

    sheet.classList.add('active');

    const render = () => {
      list.innerHTML = (reel.comments || []).map(c => `
        <div class="reel-comment-item">
          <img src="${c.userPhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${c.username}`}" class="reel-cmt-avatar" />
          <div class="reel-cmt-content">
            <span class="reel-cmt-user">${c.username}</span>
            <span class="reel-cmt-text">${this.escapeHTML(c.text)}</span>
          </div>
        </div>
      `).join('') || '<div class="no-comments">No comments yet. Be the first!</div>';
    };

    render();

    form.onsubmit = async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text || !state.currentUser) return;

      const cmt = {
        userId: state.currentUser.uid,
        username: state.currentUser.username,
        userPhoto: state.currentUser.photoURL,
        text,
        createdAt: Date.now()
      };

      if (!Array.isArray(reel.comments)) reel.comments = [];
      reel.comments.push(cmt);
      input.value = '';
      render();

      // Update in storage
      await firebaseService.addReelComment(reel.id, cmt);
    };

    const closeBtn = document.getElementById('reel-comments-close');
    if (closeBtn) closeBtn.onclick = () => sheet.classList.remove('active');
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

export const reelsManager = new ReelsManager();
