/**
 * Aura - Instagram Stories System
 * Stories Tray, Segmented Progress Timers, Reactions, and Fullscreen Viewer
 */
import { firebaseService } from './firebase-service.js';
import { state } from './state.js';

class StoriesManager {
  constructor() {
    this.activeStories = [];
    this.currentStoryIndex = 0;
    this.currentUserStories = [];
    this.storyTimer = null;
    this.isPaused = false;
    this.storyDuration = 5000; // 5 seconds per image story
    this.progressStartTime = 0;
    this.progressElapsed = 0;

    this.initListeners();
  }

  initListeners() {
    firebaseService.subscribe('STORIES_UPDATED', () => {
      this.loadStories();
    });
  }

  async loadStories() {
    const stories = await firebaseService.getActiveStories();
    this.activeStories = stories;
    this.renderStoriesTray();
  }

  renderStoriesTray() {
    const tray = document.getElementById('stories-tray');
    if (!tray) return;

    tray.innerHTML = '';
    const currentUser = state.currentUser;
    if (!currentUser) return;

    // Group stories by userId
    const grouped = new Map();
    this.activeStories.forEach(story => {
      if (!grouped.has(story.userId)) {
        grouped.set(story.userId, []);
      }
      grouped.get(story.userId).push(story);
    });

    // 1. Current User's Bubble
    const myStories = grouped.get(currentUser.uid) || [];
    const hasMyStory = myStories.length > 0;

    const myBubble = document.createElement('div');
    myBubble.className = `story-bubble ${hasMyStory ? 'has-story' : 'add-story'}`;
    myBubble.innerHTML = `
      <div class="story-avatar-wrap ${hasMyStory ? 'gradient-ring' : ''}">
        <img src="${currentUser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${currentUser.username}`}" alt="${currentUser.username}" class="story-avatar" />
        <div class="story-add-badge" title="Add Story">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </div>
      </div>
      <span class="story-username">Your story</span>
    `;

    const addBadge = myBubble.querySelector('.story-add-badge');
    if (addBadge) {
      addBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        state.emit('open:create-modal', { mode: 'story' });
      });
    }

    myBubble.addEventListener('click', () => {
      if (hasMyStory) {
        this.openStoryViewer(currentUser.uid);
      } else {
        state.emit('open:create-modal', { mode: 'story' });
      }
    });

    tray.appendChild(myBubble);

    // 2. Other users' story bubbles
    grouped.forEach((userStories, userId) => {
      if (userId === currentUser.uid) return;

      const firstStory = userStories[0];
      const allSeen = userStories.every(s => Array.isArray(s.viewers) && s.viewers.includes(currentUser.uid));

      const bubble = document.createElement('div');
      bubble.className = 'story-bubble has-story';
      bubble.innerHTML = `
        <div class="story-avatar-wrap ${allSeen ? 'seen-ring' : 'gradient-ring'}">
          <img src="${firstStory.userPhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${firstStory.username}`}" alt="${firstStory.username}" class="story-avatar" />
        </div>
        <span class="story-username">${firstStory.username}</span>
      `;

      bubble.addEventListener('click', () => {
        this.openStoryViewer(userId);
      });

      tray.appendChild(bubble);
    });
  }

  openStoryViewer(userId) {
    const storiesForUser = this.activeStories
      .filter(s => s.userId === userId)
      .sort((a, b) => a.createdAt - b.createdAt);

    if (storiesForUser.length === 0) return;

    this.currentUserStories = storiesForUser;
    this.currentStoryIndex = 0;

    const modal = document.getElementById('story-viewer-modal');
    if (!modal) return;

    modal.classList.add('active');
    document.body.classList.add('modal-open');

    this.renderCurrentStory();
  }

  closeStoryViewer() {
    this.clearStoryTimer();
    const modal = document.getElementById('story-viewer-modal');
    if (modal) modal.classList.remove('active');
    document.body.classList.remove('modal-open');

    // Pause any playing story video
    const video = document.getElementById('story-video-player');
    if (video) {
      video.pause();
      video.src = '';
    }

    this.loadStories(); // Refresh seen rings
  }

  renderCurrentStory() {
    this.clearStoryTimer();

    const story = this.currentUserStories[this.currentStoryIndex];
    if (!story) {
      this.closeStoryViewer();
      return;
    }

    // Mark as viewed
    if (state.currentUser) {
      firebaseService.markStoryViewed(story.id, state.currentUser.uid);
    }

    // Render Progress Bars
    const progressContainer = document.getElementById('story-progress-bars');
    if (progressContainer) {
      progressContainer.innerHTML = '';
      this.currentUserStories.forEach((_, idx) => {
        const barWrap = document.createElement('div');
        barWrap.className = 'story-progress-bar';

        const fill = document.createElement('div');
        fill.className = 'story-progress-fill';
        if (idx < this.currentStoryIndex) {
          fill.style.width = '100%';
        } else if (idx === this.currentStoryIndex) {
          fill.style.width = '0%';
          this.activeFillElement = fill;
        } else {
          fill.style.width = '0%';
        }

        barWrap.appendChild(fill);
        progressContainer.appendChild(barWrap);
      });
    }

    // User details header
    const avatarEl = document.getElementById('story-viewer-avatar');
    const usernameEl = document.getElementById('story-viewer-username');
    const timeEl = document.getElementById('story-viewer-time');
    const deleteBtn = document.getElementById('story-viewer-delete-btn');

    if (avatarEl) avatarEl.src = story.userPhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${story.username}`;
    if (usernameEl) usernameEl.textContent = story.username;
    if (timeEl) timeEl.textContent = this.formatTimeAgo(story.createdAt);

    if (deleteBtn) {
      if (state.currentUser && state.currentUser.uid === story.userId) {
        deleteBtn.style.display = 'flex';
        deleteBtn.onclick = async () => {
          if (confirm('Delete this story?')) {
            await firebaseService.deleteStory(story.id, state.currentUser.uid);
            state.showToast('Story deleted', 'info');
            this.currentUserStories.splice(this.currentStoryIndex, 1);
            if (this.currentUserStories.length === 0) {
              this.closeStoryViewer();
            } else {
              if (this.currentStoryIndex >= this.currentUserStories.length) {
                this.currentStoryIndex = this.currentUserStories.length - 1;
              }
              this.renderCurrentStory();
            }
          }
        };
      } else {
        deleteBtn.style.display = 'none';
      }
    }

    // Media display
    const imgEl = document.getElementById('story-image-player');
    const videoEl = document.getElementById('story-video-player');
    const captionEl = document.getElementById('story-viewer-caption');

    if (captionEl) {
      captionEl.textContent = story.caption || '';
      captionEl.style.display = story.caption ? 'block' : 'none';
    }

    const isVideo = story.mediaType === 'video' || (story.mediaUrl && story.mediaUrl.match(/\.(mp4|webm|mov)(\?.*)?$/i));

    if (isVideo) {
      if (imgEl) imgEl.style.display = 'none';
      if (videoEl) {
        videoEl.style.display = 'block';
        videoEl.src = story.mediaUrl;
        videoEl.currentTime = 0;
        videoEl.play().catch(() => {});
        videoEl.onloadedmetadata = () => {
          this.storyDuration = (videoEl.duration || 5) * 1000;
          this.startStoryTimer();
        };
      }
    } else {
      if (videoEl) {
        videoEl.pause();
        videoEl.style.display = 'none';
      }
      if (imgEl) {
        imgEl.style.display = 'block';
        imgEl.src = story.mediaUrl;
        this.storyDuration = 5000; // 5s for photos
        this.startStoryTimer();
      }
    }

    // Setup Reply and Reaction Handlers
    const replyInput = document.getElementById('story-reply-input');
    const replySend = document.getElementById('story-reply-send');
    if (replyInput && replySend) {
      replyInput.value = '';
      replySend.onclick = async () => {
        const text = replyInput.value.trim();
        if (text && state.currentUser) {
          await firebaseService.sendMessage(
            state.currentUser.uid,
            story.userId,
            `Replied to your story: "${text}"`,
            story.mediaUrl
          );
          state.showToast('Reply sent to direct message!', 'success');
          replyInput.value = '';
        }
      };
    }
  }

  startStoryTimer() {
    this.clearStoryTimer();
    this.progressStartTime = Date.now();
    this.progressElapsed = 0;
    this.isPaused = false;

    const tickInterval = 50;
    this.storyTimer = setInterval(() => {
      if (this.isPaused) return;

      this.progressElapsed += tickInterval;
      const progressPercent = Math.min((this.progressElapsed / this.storyDuration) * 100, 100);

      if (this.activeFillElement) {
        this.activeFillElement.style.width = `${progressPercent}%`;
      }

      if (this.progressElapsed >= this.storyDuration) {
        this.nextStory();
      }
    }, tickInterval);
  }

  pauseStory() {
    this.isPaused = true;
    const video = document.getElementById('story-video-player');
    if (video) video.pause();
  }

  resumeStory() {
    this.isPaused = false;
    const video = document.getElementById('story-video-player');
    if (video && video.style.display !== 'none') video.play().catch(() => {});
  }

  clearStoryTimer() {
    if (this.storyTimer) {
      clearInterval(this.storyTimer);
      this.storyTimer = null;
    }
  }

  nextStory() {
    if (this.currentStoryIndex < this.currentUserStories.length - 1) {
      this.currentStoryIndex++;
      this.renderCurrentStory();
    } else {
      // Find next user's story or close
      this.closeStoryViewer();
    }
  }

  prevStory() {
    if (this.currentStoryIndex > 0) {
      this.currentStoryIndex--;
      this.renderCurrentStory();
    } else {
      this.renderCurrentStory(); // replay
    }
  }

  sendQuickReaction(emoji) {
    if (!state.currentUser) return;
    const story = this.currentUserStories[this.currentStoryIndex];
    if (!story) return;

    firebaseService.sendMessage(
      state.currentUser.uid,
      story.userId,
      `Reacted ${emoji} to your story!`,
      story.mediaUrl
    );
    state.showToast(`Sent ${emoji} reaction!`, 'success');
  }

  formatTimeAgo(timestamp) {
    const sec = Math.floor((Date.now() - timestamp) / 1000);
    if (sec < 60) return 'Just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `${hrs}h`;
    return '1d';
  }
}

export const storiesManager = new StoriesManager();
