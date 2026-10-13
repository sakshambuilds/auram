/**
 * Aura - Main Feed, Posts, Like Animations, Comments & Interactions
 */
import { firebaseService } from './firebase-service.js';
import { state } from './state.js';

class FeedManager {
  constructor() {
    this.posts = [];
    this.initListeners();
  }

  initListeners() {
    firebaseService.subscribe('POSTS_UPDATED', (posts) => {
      this.posts = posts;
      if (state.currentView === 'feed') {
        this.renderFeed();
      }
    });

    state.on('view:changed', ({ view }) => {
      if (view === 'feed') {
        this.loadFeed();
      }
    });
  }

  async loadFeed() {
    const posts = await firebaseService.getPosts();
    this.posts = posts;
    this.renderFeed();
  }

  renderFeed() {
    const container = document.getElementById('feed-posts-container');
    if (!container) return;

    if (this.posts.length === 0) {
      container.innerHTML = `
        <div class="empty-feed-card">
          <div class="empty-icon-wrap">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </div>
          <h3>Welcome to Aura</h3>
          <p>When people you follow share photos and videos, they'll appear here. Share your first moment!</p>
          <button class="aura-btn aura-btn-primary" id="empty-feed-create-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            Create Your First Post
          </button>
        </div>
      `;

      const createBtn = document.getElementById('empty-feed-create-btn');
      if (createBtn) {
        createBtn.onclick = () => state.emit('open:create-modal', { mode: 'post' });
      }
      return;
    }

    container.innerHTML = '';
    const currentUser = state.currentUser;

    this.posts.forEach(post => {
      const isLiked = currentUser && Array.isArray(post.likes) && post.likes.includes(currentUser.uid);
      const isSaved = currentUser && Array.isArray(currentUser.savedPosts) && currentUser.savedPosts.includes(post.id);
      const isVideo = post.mediaType === 'video' || (post.mediaUrl && post.mediaUrl.match(/\.(mp4|webm|mov)(\?.*)?$/i));

      const postEl = document.createElement('article');
      postEl.className = 'aura-post-card';
      postEl.dataset.postId = post.id;

      postEl.innerHTML = `
        <!-- Header -->
        <header class="post-card-header">
          <div class="post-author-info" data-user-id="${post.userId}">
            <div class="post-author-avatar-wrap">
              <img src="${post.userPhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${post.username}`}" alt="${post.username}" class="post-author-avatar" />
            </div>
            <div class="post-author-meta">
              <span class="post-username">${post.username}</span>
              ${post.location ? `<span class="post-location">${post.location}</span>` : ''}
            </div>
          </div>
          <button class="post-options-btn" data-post-id="${post.id}" aria-label="Post options">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="2"></circle>
              <circle cx="19" cy="12" r="2"></circle>
              <circle cx="5" cy="12" r="2"></circle>
            </svg>
          </button>
        </header>

        <!-- Media Stage -->
        <div class="post-media-stage" data-post-id="${post.id}">
          ${isVideo ? `
            <video class="post-media-video" src="${post.mediaUrl}" loop playsinline preload="metadata"></video>
            <button class="video-sound-toggle" aria-label="Toggle sound">
              <svg class="icon-muted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <line x1="23" y1="9" x2="17" y2="15"></line>
                <line x1="17" y1="9" x2="23" y2="15"></line>
              </svg>
              <svg class="icon-unmuted" style="display:none;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
            </button>
          ` : `
            <img class="post-media-img" src="${post.mediaUrl}" alt="${post.caption || 'Aura Post'}" loading="lazy" />
          `}
          <!-- Double Tap Heart Burst -->
          <div class="heart-burst-overlay">
            <svg width="88" height="88" viewBox="0 0 24 24" fill="#ff3040">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
            </svg>
          </div>
        </div>

        <!-- Action Bar -->
        <div class="post-action-bar">
          <div class="post-actions-left">
            <button class="post-action-btn like-btn ${isLiked ? 'liked' : ''}" data-post-id="${post.id}" aria-label="Like post">
              <svg class="heart-icon" width="24" height="24" viewBox="0 0 24 24" fill="${isLiked ? '#ff3040' : 'none'}" stroke="${isLiked ? '#ff3040' : 'currentColor'}" stroke-width="2">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
              </svg>
            </button>
            <button class="post-action-btn comment-btn" data-post-id="${post.id}" aria-label="Comment">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
              </svg>
            </button>
            <button class="post-action-btn share-btn" data-post-id="${post.id}" aria-label="Share">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
          <div class="post-actions-right">
            <button class="post-action-btn bookmark-btn ${isSaved ? 'saved' : ''}" data-post-id="${post.id}" aria-label="Save post">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
              </svg>
            </button>
          </div>
        </div>

        <!-- Likes counter -->
        <div class="post-likes-count" data-post-id="${post.id}">
          <span>${(post.likes || []).length} likes</span>
        </div>

        <!-- Caption -->
        <div class="post-caption-box">
          <span class="caption-username" data-user-id="${post.userId}">${post.username}</span>
          ${(post.caption && post.caption.length > 85) ? `
            <span class="caption-text">
              <span class="caption-text-short">${this.formatCaptionWithTags(post.caption.slice(0, 85))}</span>
              <button class="caption-more-btn" type="button">... more</button>
              <span class="caption-text-full" style="display:none;">${this.formatCaptionWithTags(post.caption)}</span>
            </span>
          ` : `
            <span class="caption-text">${this.formatCaptionWithTags(post.caption || '')}</span>
          `}
        </div>

        <!-- Comments preview -->
        <div class="post-comments-section" data-post-id="${post.id}">
          ${(post.comments && post.comments.length > 0) ? `
            <button class="view-all-comments-btn" data-post-id="${post.id}">
              ${post.comments.length > 2 ? `View all ${post.comments.length} comments` : (post.comments.length === 1 ? 'View 1 comment' : 'View all 2 comments')}
            </button>
          ` : ''}
          <div class="comments-list-preview">
            ${(post.comments || []).slice(-2).map(c => `
              <div class="comment-item-preview">
                <span class="comment-author">${c.username}</span>
                <span class="comment-body">${this.escapeHTML(c.text)}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Post Date -->
        <div class="post-timestamp">
          ${this.formatTimeAgo(post.createdAt)}
        </div>

        <!-- Inline Comment Input (Desktop) -->
        <form class="post-comment-form" data-post-id="${post.id}">
          <button type="button" class="emoji-picker-btn" aria-label="Emoji">😊</button>
          <input type="text" class="comment-input" placeholder="Add a comment..." required />
          <button type="submit" class="comment-submit-btn">Post</button>
        </form>
      `;

      // Event handlers on post
      this.attachPostEvents(postEl, post);
      container.appendChild(postEl);
    });
  }

  attachPostEvents(postEl, post) {
    const mediaStage = postEl.querySelector('.post-media-stage');
    const heartBurst = postEl.querySelector('.heart-burst-overlay');
    const likeBtn = postEl.querySelector('.like-btn');
    const likesCountEl = postEl.querySelector('.post-likes-count span');
    const bookmarkBtn = postEl.querySelector('.bookmark-btn');
    const shareBtn = postEl.querySelector('.share-btn');
    const optionsBtn = postEl.querySelector('.post-options-btn');
    const commentForm = postEl.querySelector('.post-comment-form');
    const commentInput = postEl.querySelector('.comment-input');
    const authorClickable = postEl.querySelectorAll('.post-author-info, .caption-username');
    const video = postEl.querySelector('.post-media-video');
    const soundToggle = postEl.querySelector('.video-sound-toggle');

    // Video play/pause on click & viewport
    if (video) {
      video.muted = true;
      video.addEventListener('click', () => {
        if (video.paused) video.play();
        else video.pause();
      });

      if (soundToggle) {
        soundToggle.addEventListener('click', (e) => {
          e.stopPropagation();
          video.muted = !video.muted;
          const mutedIcon = soundToggle.querySelector('.icon-muted');
          const unmutedIcon = soundToggle.querySelector('.icon-unmuted');
          if (video.muted) {
            mutedIcon.style.display = 'block';
            unmutedIcon.style.display = 'none';
          } else {
            mutedIcon.style.display = 'none';
            unmutedIcon.style.display = 'block';
          }
        });
      }
    }

    // Double tap to like (touch & pointer support)
    let lastTap = 0;
    const handleDoubleTap = async (e) => {
      const now = Date.now();
      if (now - lastTap < 350) {
        this.triggerHeartBurst(heartBurst);
        await this.handleLike(post.id, likeBtn, likesCountEl);
        lastTap = 0;
      } else {
        lastTap = now;
      }
    };
    mediaStage.addEventListener('click', handleDoubleTap);

    // Single Like Button Click
    likeBtn.addEventListener('click', async () => {
      await this.handleLike(post.id, likeBtn, likesCountEl);
    });

    // Action Bar Comment Button -> Opens Comments Sheet
    const commentBtn = postEl.querySelector('.comment-btn');
    if (commentBtn) {
      commentBtn.addEventListener('click', () => {
        this.openCommentsModal(post);
      });
    }

    // Bookmark / Save Button Click
    bookmarkBtn.addEventListener('click', async () => {
      if (!state.currentUser) return;
      const isSaved = await firebaseService.toggleSavePost(post.id, state.currentUser.uid);
      if (isSaved) {
        bookmarkBtn.classList.add('saved');
        bookmarkBtn.querySelector('svg').setAttribute('fill', 'currentColor');
        state.showToast('Post saved to bookmarks', 'success');
      } else {
        bookmarkBtn.classList.remove('saved');
        bookmarkBtn.querySelector('svg').setAttribute('fill', 'none');
        state.showToast('Post removed from bookmarks', 'info');
      }
    });

    // Share Button Click
    shareBtn.addEventListener('click', () => {
      this.openShareModal(post);
    });

    // Post Options (...)
    optionsBtn.addEventListener('click', () => {
      this.openPostOptionsMenu(post);
    });

    // Author click -> Profile
    authorClickable.forEach(el => {
      el.addEventListener('click', () => {
        state.setView('profile', { userId: post.userId });
      });
    });

    // Caption "... more" toggle button
    const moreBtn = postEl.querySelector('.caption-more-btn');
    if (moreBtn) {
      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const shortSpan = postEl.querySelector('.caption-text-short');
        const fullSpan = postEl.querySelector('.caption-text-full');
        if (shortSpan) shortSpan.style.display = 'none';
        moreBtn.style.display = 'none';
        if (fullSpan) fullSpan.style.display = 'inline';
      });
    }

    // Comment Form Submit (desktop)
    if (commentForm) {
      commentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = commentInput.value.trim();
        if (!text || !state.currentUser) return;

        await firebaseService.addComment(post.id, {
          userId: state.currentUser.uid,
          username: state.currentUser.username,
          userPhoto: state.currentUser.photoURL,
          text
        });

        commentInput.value = '';

        // Update preview directly
        const listPreview = postEl.querySelector('.comments-list-preview');
        if (listPreview) {
          const item = document.createElement('div');
          item.className = 'comment-item-preview';
          item.innerHTML = `
            <span class="comment-author">${state.currentUser.username}</span>
            <span class="comment-body">${this.escapeHTML(text)}</span>
          `;
          listPreview.appendChild(item);
        }

        state.showToast('Comment posted', 'success');
      });
    }

    // View All Comments Modal / Sheet
    const viewAllBtn = postEl.querySelector('.view-all-comments-btn');
    if (viewAllBtn) {
      viewAllBtn.addEventListener('click', () => {
        this.openCommentsModal(post);
      });
    }

    // Options button (...)
    if (optionsBtn) {
      optionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openPostOptionsMenu(post);
      });
    }

    // Likes count click -> Show likers modal
    const likesWrap = postEl.querySelector('.post-likes-count');
    if (likesWrap) {
      likesWrap.addEventListener('click', () => {
        this.openLikesModal(post);
      });
    }
  }

  triggerHeartBurst(overlay) {
    if (!overlay) return;
    overlay.classList.add('burst');
    setTimeout(() => {
      overlay.classList.remove('burst');
    }, 900);
  }

  async handleLike(postId, likeBtn, countSpan) {
    if (!state.currentUser) return;
    const res = await firebaseService.toggleLikePost(postId, state.currentUser.uid);
    if (!res) return;

    if (res.liked) {
      likeBtn.classList.add('liked');
      likeBtn.querySelector('svg').setAttribute('fill', '#ff3040');
      likeBtn.querySelector('svg').setAttribute('stroke', '#ff3040');
    } else {
      likeBtn.classList.remove('liked');
      likeBtn.querySelector('svg').setAttribute('fill', 'none');
      likeBtn.querySelector('svg').setAttribute('stroke', 'currentColor');
    }

    if (countSpan) {
      countSpan.textContent = `${res.count} likes`;
    }
  }

  openPostOptionsMenu(post, onDeleted = null) {
    const isOwner = state.currentUser && state.currentUser.uid === post.userId;
    const modal = document.getElementById('options-modal');
    const list = document.getElementById('options-modal-list');
    if (!modal || !list) return;

    list.innerHTML = `
      ${isOwner ? '<button class="opt-btn opt-danger" id="opt-delete-post">Delete Post</button>' : ''}
      <button class="opt-btn" id="opt-copy-link">Copy Link</button>
      <button class="opt-btn" id="opt-share-direct">Share to Direct</button>
      <button class="opt-btn" id="opt-view-profile">View Profile</button>
      <button class="opt-btn opt-cancel" id="opt-cancel">Cancel</button>
    `;

    modal.classList.add('active');

    const delBtn = document.getElementById('opt-delete-post');
    if (delBtn) {
      delBtn.onclick = async () => {
        modal.classList.remove('active');
        if (!state.currentUser || state.currentUser.uid !== post.userId) {
          state.showToast("You cannot delete another person's post", 'error');
          return;
        }
        if (confirm('Delete this post? This action cannot be undone.')) {
          try {
            await firebaseService.deletePost(post.id, state.currentUser.uid);
            state.showToast('Post deleted', 'info');
            const card = document.querySelector(`.aura-post-card[data-post-id="${post.id}"]`);
            if (card) card.remove();
            this.posts = this.posts.filter(p => p.id !== post.id);
            if (typeof onDeleted === 'function') onDeleted();
          } catch (err) {
            state.showToast(err.message || 'Failed to delete post', 'error');
          }
        }
      };
    }

    document.getElementById('opt-copy-link').onclick = () => {
      navigator.clipboard.writeText(window.location.origin + '?post=' + post.id);
      state.showToast('Link copied to clipboard', 'success');
      modal.classList.remove('active');
    };

    document.getElementById('opt-share-direct').onclick = () => {
      modal.classList.remove('active');
      this.openShareModal(post);
    };

    document.getElementById('opt-view-profile').onclick = () => {
      modal.classList.remove('active');
      state.setView('profile', { userId: post.userId });
    };

    document.getElementById('opt-cancel').onclick = () => {
      modal.classList.remove('active');
    };
  }

  openShareModal(post) {
    const modal = document.getElementById('share-modal');
    if (!modal) return;
    modal.classList.add('active');

    const input = document.getElementById('share-url-input');
    if (input) input.value = window.location.origin + '?post=' + post.id;

    const copyBtn = document.getElementById('share-copy-btn');
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(input.value);
        state.showToast('Link copied!', 'success');
        modal.classList.remove('active');
      };
    }
  }

  openCommentsModal(post) {
    const modal = document.getElementById('post-detail-modal');
    if (!modal) return;

    modal.classList.add('active');
    document.body.classList.add('modal-open');

    // Populate post detail media & comments
    const imgStage = document.getElementById('modal-post-media');
    const commentsList = document.getElementById('modal-post-comments');
    const authorHeader = document.getElementById('modal-post-author');
    const captionEl = document.getElementById('modal-post-caption');
    const commentForm = document.getElementById('modal-post-comment-form');
    const commentInput = document.getElementById('modal-post-comment-input');
    const closeBtn = document.getElementById('modal-post-close-btn');
    const dragHandle = document.getElementById('post-sheet-drag-handle');
    const userAvatarImg = document.getElementById('modal-comment-user-avatar');

    if (userAvatarImg && state.currentUser) {
      userAvatarImg.src = state.currentUser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${state.currentUser.username}`;
    }

    const closeModal = () => {
      modal.classList.remove('active');
      document.body.classList.remove('modal-open');
    };

    if (closeBtn) closeBtn.onclick = closeModal;
    if (dragHandle) dragHandle.onclick = closeModal;

    // Quick Emojis
    const emojiBtns = document.querySelectorAll('#comments-quick-emojis .quick-emoji-btn');
    emojiBtns.forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        if (commentInput) {
          commentInput.value += btn.textContent;
          commentInput.focus();
        }
      };
    });

    if (authorHeader) {
      const isOwner = state.currentUser && state.currentUser.uid === post.userId;
      authorHeader.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
          <img src="${post.userPhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${post.username}`}" class="modal-author-avatar" style="width:28px;height:28px;border-radius:50%;" />
          <span style="font-weight:700;font-size:15px;">${post.username}</span>
        </div>
        <div style="display:flex; align-items:center; gap:12px;">
          ${isOwner ? `
            <button id="modal-post-options-btn" title="Post Options" style="background:none;border:none;color:var(--text-primary);cursor:pointer;padding:4px;display:flex;align-items:center;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="2"></circle>
                <circle cx="19" cy="12" r="2"></circle>
                <circle cx="5" cy="12" r="2"></circle>
              </svg>
            </button>
          ` : ''}
          <button id="modal-post-close-btn-inner" class="drawer-close-btn" style="color:var(--text-secondary);font-size:18px;">✕</button>
        </div>
      `;
      const innerClose = document.getElementById('modal-post-close-btn-inner');
      if (innerClose) innerClose.onclick = closeModal;

      const optBtn = document.getElementById('modal-post-options-btn');
      if (optBtn) {
        optBtn.onclick = () => {
          this.openPostOptionsMenu(post, () => closeModal());
        };
      }
    }

    const isVideo = post.mediaType === 'video' || (post.mediaUrl && post.mediaUrl.match(/\.(mp4|webm|mov)(\?.*)?$/i));
    if (imgStage) {
      imgStage.innerHTML = isVideo
        ? `<video src="${post.mediaUrl}" controls autoplay loop class="modal-media-elem"></video>`
        : `<img src="${post.mediaUrl}" class="modal-media-elem" />`;
    }

    if (captionEl) {
      captionEl.innerHTML = `
        <div style="display:flex; gap:10px; width:100%;">
          <img src="${post.userPhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${post.username}`}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;" />
          <div style="display:flex;flex-direction:column;font-size:13px;line-height:1.4;">
            <div>
              <span style="font-weight:700;margin-right:6px;">${post.username}</span>
              <span>${this.formatCaptionWithTags(post.caption || '')}</span>
            </div>
            <span style="font-size:11px;color:var(--text-muted);margin-top:3px;">${this.formatTimeAgo(post.createdAt)}</span>
          </div>
        </div>
      `;
    }

    const renderComments = () => {
      if (!commentsList) return;
      commentsList.innerHTML = (post.comments || []).map((c, idx) => `
        <div class="modal-comment-row" style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
          <div style="display:flex; gap:10px; flex:1;">
            <img src="${c.userPhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${c.username}`}" class="modal-comment-avatar" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;" />
            <div class="modal-comment-content" style="display:flex;flex-direction:column;font-size:13px;line-height:1.35;">
              <div>
                <span class="comment-author" style="font-weight:700;margin-right:6px;">${c.username}</span>
                <span class="comment-text">${this.escapeHTML(c.text)}</span>
              </div>
              <div style="display:flex; gap:12px; font-size:11px; color:var(--text-muted); margin-top:3px;">
                <span>${this.formatTimeAgo(c.createdAt || Date.now())}</span>
                <span style="font-weight:600; cursor:pointer;" onclick="const inp=document.getElementById('modal-post-comment-input'); if(inp){inp.value='@${c.username} '; inp.focus();}">Reply</span>
              </div>
            </div>
          </div>
          <button class="comment-heart-btn" style="color:var(--text-muted);padding:4px;cursor:pointer;" onclick="this.style.color = this.style.color === 'rgb(255, 48, 64)' ? 'var(--text-muted)' : '#ff3040';">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
            </svg>
          </button>
        </div>
      `).join('') || '<div class="no-comments" style="text-align:center;color:var(--text-secondary);font-size:14px;padding:30px 10px;">No comments yet. Start the conversation!</div>';
    };

    renderComments();

    if (commentForm) {
      commentForm.onsubmit = async (e) => {
        e.preventDefault();
        const text = commentInput.value.trim();
        if (!text || !state.currentUser) return;

        const newCommentObj = {
          userId: state.currentUser.uid,
          username: state.currentUser.username,
          userPhoto: state.currentUser.photoURL,
          text,
          createdAt: Date.now()
        };

        if (!post.comments) post.comments = [];
        post.comments.push(newCommentObj);

        await firebaseService.addComment(post.id, newCommentObj);

        commentInput.value = '';
        renderComments();

        // Scroll to bottom
        const scrollBox = document.getElementById('modal-comments-scroll');
        if (scrollBox) scrollBox.scrollTop = scrollBox.scrollHeight;

        // Also update view all comments button text in feed if present
        const postCard = document.querySelector(`.aura-post-card[data-post-id="${post.id}"]`);
        if (postCard) {
          const btn = postCard.querySelector('.view-all-comments-btn');
          if (btn) btn.textContent = `View all ${post.comments.length} comments`;
        }
      };
    }
  }

  async openLikesModal(post) {
    const modal = document.getElementById('likes-modal');
    const container = document.getElementById('likes-modal-list');
    if (!modal || !container) return;

    modal.classList.add('active');
    container.innerHTML = '<div class="loading-spinner"></div>';

    const users = firebaseService.getLocalUsers();
    const likers = (post.likes || []).map(uid => users.find(u => u.uid === uid) || { uid, username: 'user_' + uid.slice(0, 5) });

    if (likers.length === 0) {
      container.innerHTML = '<div class="no-likes">No likes yet.</div>';
      return;
    }

    container.innerHTML = likers.map(u => `
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
  }

  formatCaptionWithTags(caption) {
    if (!caption) return '';
    return this.escapeHTML(caption)
      .replace(/#([\w\u00A0-\uFFFF]+)/g, '<span class="aura-hashtag">#$1</span>')
      .replace(/@([\w\u00A0-\uFFFF]+)/g, '<span class="aura-mention">@$1</span>');
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

  formatTimeAgo(timestamp) {
    const sec = Math.floor((Date.now() - timestamp) / 1000);
    if (sec < 60) return 'Just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  }
}

export const feedManager = new FeedManager();
