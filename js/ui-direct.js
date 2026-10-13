/**
 * Aura - Instagram Direct Messaging (DMs)
 * Conversations List, Live Messaging, Media Attachments & Simulated Calls
 */
import { firebaseService } from './firebase-service.js';
import { CloudinaryService } from './cloudinary-service.js';
import { state } from './state.js';
import { CameraService } from './camera-service.js';

class CallAudioSynthesizer {
  constructor() {
    this.audioCtx = null;
    this.ringInterval = null;
  }

  ensureContext() {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  startRinging() {
    this.stopRinging();
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const playBurst = () => {
        try {
          if (!this.audioCtx || this.audioCtx.state === 'closed') return;
          const now = this.audioCtx.currentTime;
          const gainNode = this.audioCtx.createGain();
          gainNode.gain.setValueAtTime(0.001, now);
          gainNode.gain.linearRampToValueAtTime(0.12, now + 0.06);
          gainNode.gain.setValueAtTime(0.12, now + 1.15);
          gainNode.gain.linearRampToValueAtTime(0.001, now + 1.3);
          gainNode.connect(this.audioCtx.destination);

          const osc1 = this.audioCtx.createOscillator();
          const osc2 = this.audioCtx.createOscillator();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(440, now);
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(480, now);
          osc1.connect(gainNode);
          osc2.connect(gainNode);
          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 1.3);
          osc2.stop(now + 1.3);
        } catch (_) {}
      };

      playBurst();
      this.ringInterval = setInterval(playBurst, 2800);
    } catch (_) {}
  }

  stopRinging() {
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
  }

  playConnectedChime() {
    this.stopRinging();
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 upward chime
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.12, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, start);
        osc.type = 'sine';
        osc.connect(gain);
        osc.start(start);
        osc.stop(start + 0.28);
      });
    } catch (_) {}
  }

  playEndChime() {
    this.stopRinging();
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const notes = [659.25, 523.25, 392.0]; // E5, C5, G4 downward tone
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.1, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, start);
        osc.type = 'sine';
        osc.connect(gain);
        osc.start(start);
        osc.stop(start + 0.28);
      });
    } catch (_) {}
  }
}

class DirectManager {
  constructor() {
    this.activePartnerId = null;
    this.activePartner = null;
    this.conversations = [];
    this.callCamera = new CameraService();
    this.callAudioSynth = new CallAudioSynthesizer();
    this.callTimer = null;
    this.callDuration = 0;
    this.callAudioStream = null;
    this.isMicMuted = false;
    this.isCamOff = false;
    this.initListeners();
  }

  initListeners() {
    const handleIncoming = (msg) => {
      if (state.currentUser && (msg.senderId === state.currentUser.uid || msg.recipientId === state.currentUser.uid)) {
        this.loadConversations(false);
        if (this.activePartnerId && (msg.senderId === this.activePartnerId || msg.recipientId === this.activePartnerId)) {
          this.renderMessages();
        }
      }
    };

    firebaseService.subscribe('MESSAGE_SENT', handleIncoming);
    firebaseService.subscribe('MESSAGES_UPDATED', () => {
      this.loadConversations(false);
      if (this.activePartnerId) {
        this.renderMessages();
      }
    });

    state.on('view:changed', ({ view, params }) => {
      if (view === 'direct' || view === 'messages') {
        if (params?.userId) {
          this.startChatWith(params.userId);
        } else {
          this.loadConversations();
        }
      }
    });
  }

  async loadConversations(fetchRemote = true) {
    if (!state.currentUser) return;
    if (fetchRemote) {
      await firebaseService.fetchMessages();
    }
    const recents = firebaseService.getRecentConversations(state.currentUser.uid);
    const users = firebaseService.getLocalUsers();

    this.conversations = recents.map(r => {
      const partner = users.find(u => u.uid === r.partnerId) || {
        uid: r.partnerId,
        username: 'user_' + r.partnerId.slice(0, 5),
        displayName: 'Aura Member',
        photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${r.partnerId}`
      };
      return {
        partner,
        lastMessage: r.lastMessage
      };
    });

    this.renderConversationsList();

    if (this.activePartnerId) {
      this.renderChatWindow();
    } else if (this.conversations.length > 0) {
      if (window.innerWidth > 768) {
        this.selectPartner(this.conversations[0].partner);
      }
    } else {
      this.renderEmptyChatWindow();
    }
  }

  async startChatWith(userId) {
    let partner = await firebaseService.getUserProfile(userId);
    if (!partner) {
      partner = {
        uid: userId,
        username: 'user_' + userId.slice(0, 5),
        displayName: 'Aura Member',
        photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${userId}`
      };
    }
    this.selectPartner(partner);
  }

  selectPartner(partner) {
    this.activePartnerId = partner.uid;
    this.activePartner = partner;
    const container = document.querySelector('.direct-container');
    if (container) container.classList.add('chat-active');
    document.body.classList.add('chat-open');
    this.renderConversationsList();
    this.renderChatWindow();

    setTimeout(() => {
      document.getElementById('direct-message-input')?.focus();
    }, 100);
  }

  renderConversationsList() {
    const listEl = document.getElementById('direct-conversations-list');
    if (!listEl) return;

    if (this.conversations.length === 0) {
      listEl.innerHTML = '<div class="direct-no-chats">No messages yet.</div>';
      return;
    }

    listEl.innerHTML = this.conversations.map(c => `
      <div class="direct-conv-item ${c.partner.uid === this.activePartnerId ? 'active' : ''}" data-uid="${c.partner.uid}">
        <div class="direct-conv-avatar-wrap">
          <img src="${c.partner.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${c.partner.username}`}" class="direct-conv-avatar" />
          <span class="online-indicator"></span>
        </div>
        <div class="direct-conv-info">
          <span class="direct-conv-name">${c.partner.username}</span>
          <span class="direct-conv-last-msg">${this.escapeHTML(c.lastMessage.content || 'Sent a photo')} · ${this.formatTime(c.lastMessage.timestamp)}</span>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('.direct-conv-item').forEach(item => {
      item.onclick = () => {
        const uid = item.dataset.uid;
        const conv = this.conversations.find(c => c.partner.uid === uid);
        if (conv) this.selectPartner(conv.partner);
      };
    });
  }

  renderEmptyChatWindow() {
    const chatPane = document.getElementById('direct-active-chat-pane');
    if (!chatPane) return;

    chatPane.innerHTML = `
      <div class="direct-empty-state">
        <div class="direct-empty-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </div>
        <h3>Your messages</h3>
        <p>Send private photos, videos, and messages to a friend or group.</p>
        <button class="aura-btn aura-btn-primary" id="direct-new-msg-btn">Send message</button>
      </div>
    `;

    const newBtn = document.getElementById('direct-new-msg-btn');
    if (newBtn) newBtn.onclick = () => this.openNewMessageModal();
  }

  renderChatWindow() {
    const chatPane = document.getElementById('direct-active-chat-pane');
    if (!chatPane || !this.activePartner) return;

    chatPane.innerHTML = `
      <!-- Top Partner Header -->
      <header class="direct-chat-header">
        <div class="direct-header-user">
          <button class="direct-mobile-back-btn" id="direct-back-btn" aria-label="Back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <img src="${this.activePartner.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${this.activePartner.username}`}" class="direct-header-avatar" />
          <div class="direct-header-meta">
            <span class="direct-header-name">${this.activePartner.username}</span>
            <span class="direct-header-status">Active now</span>
          </div>
        </div>
        <div class="direct-header-actions">
          <button class="direct-icon-btn" id="direct-call-btn" title="Audio Call">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            </svg>
          </button>
          <button class="direct-icon-btn" id="direct-videocall-btn" title="Video Call">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="23 7 16 12 23 17 23 7"></polygon>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
          </button>
          <button class="direct-icon-btn" id="direct-info-btn" title="Conversation Details">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </button>
        </div>
      </header>

      <!-- Messages Stream -->
      <div class="direct-messages-stream" id="direct-messages-stream"></div>

      <!-- Bottom Chat Composer Form -->
      <footer class="direct-composer-footer">
        <form class="direct-composer-form" id="direct-composer-form">
          <label class="direct-composer-btn attach-media-label" title="Send Photo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <input type="file" id="direct-media-file" accept="image/*" style="display:none;" />
          </label>
          <input type="text" id="direct-message-input" class="direct-message-input" placeholder="Message..." autocomplete="off" />
          <button type="button" class="direct-composer-btn" id="direct-heart-btn" title="Send Heart">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
            </svg>
          </button>
          <button type="submit" class="direct-send-btn" id="direct-send-btn">Send</button>
        </form>
      </footer>
    `;

    // Setup events
    this.renderMessages();

    const form = document.getElementById('direct-composer-form');
    const input = document.getElementById('direct-message-input');
    const mediaInput = document.getElementById('direct-media-file');
    const heartBtn = document.getElementById('direct-heart-btn');
    const callBtn = document.getElementById('direct-call-btn');
    const videoCallBtn = document.getElementById('direct-videocall-btn');
    const backBtn = document.getElementById('direct-back-btn');

    if (backBtn) {
      backBtn.onclick = () => {
        const container = document.querySelector('.direct-container');
        if (container) container.classList.remove('chat-active');
        document.body.classList.remove('chat-open');
        this.activePartnerId = null;
        this.activePartner = null;
        this.renderConversationsList();
      };
    }

    form.onsubmit = async (e) => {
      e.preventDefault();
      const content = input.value.trim();
      if (!content || !state.currentUser || !this.activePartnerId) return;

      input.value = '';
      await firebaseService.sendMessage(state.currentUser.uid, this.activePartnerId, content);
      this.renderMessages();
      this.loadConversations(false);
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit ? form.requestSubmit() : form.onsubmit(e);
      }
    });

    heartBtn.onclick = async () => {
      if (!state.currentUser || !this.activePartnerId) return;
      await firebaseService.sendMessage(state.currentUser.uid, this.activePartnerId, '❤️');
      this.renderMessages();
      this.loadConversations(false);
    };

    mediaInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file || !state.currentUser || !this.activePartnerId) return;

      state.showToast('Uploading photo to chat...', 'info');
      try {
        const upload = await CloudinaryService.uploadMedia(file, 'image');
        await firebaseService.sendMessage(
          state.currentUser.uid,
          this.activePartnerId,
          '',
          upload.secure_url
        );
        state.showToast('Photo sent!', 'success');
      } catch (err) {
        state.showToast('Photo upload failed: ' + err.message, 'error');
      }
    };

    callBtn.onclick = () => this.openCallModal('audio');
    videoCallBtn.onclick = () => this.openCallModal('video');
  }

  renderMessages() {
    const stream = document.getElementById('direct-messages-stream');
    if (!stream || !state.currentUser || !this.activePartnerId) return;

    const messages = firebaseService.getMessages(state.currentUser.uid, this.activePartnerId);

    stream.innerHTML = messages.map(m => {
      const isMine = m.senderId === state.currentUser.uid;
      return `
        <div class="direct-msg-row ${isMine ? 'mine' : 'theirs'}">
          ${!isMine ? `<img src="${this.activePartner.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${this.activePartner.username}`}" class="msg-avatar" />` : ''}
          <div class="direct-msg-bubble">
            ${m.mediaUrl ? `<img src="${m.mediaUrl}" class="msg-attached-image" onclick="window.open('${m.mediaUrl}', '_blank')" />` : ''}
            ${m.content ? `<span class="msg-text">${this.escapeHTML(m.content)}</span>` : ''}
            <span class="msg-time">${this.formatTime(m.timestamp)}</span>
          </div>
        </div>
      `;
    }).join('');

    // Scroll to bottom
    stream.scrollTop = stream.scrollHeight;
  }

  formatCallDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }

  async openCallModal(type = 'video', targetUser = null) {
    const modal = document.getElementById('call-simulation-modal');
    if (!modal) {
      console.warn('[Call] Call modal element #call-simulation-modal not found');
      return;
    }

    // 1. Resolve partner details: prioritize passed targetUser, then activePartner, then activePartnerId, then fallback to any user
    let partner = targetUser || this.activePartner;
    if (!partner && this.activePartnerId) {
      partner = firebaseService.getLocalUsers().find(u => u.uid === this.activePartnerId);
    }
    if (!partner) {
      const allUsers = firebaseService.getLocalUsers().filter(u => u.uid !== state.currentUser?.uid);
      if (allUsers.length > 0) partner = allUsers[0];
    }
    if (!partner) {
      partner = {
        uid: 'aura_member',
        username: 'aura_friend',
        displayName: 'Aura Member',
        photoURL: 'https://api.dicebear.com/7.x/adventurer/svg?seed=friend'
      };
    }
    this.activePartner = partner;
    this.activePartnerId = partner.uid;

    const partnerName = partner.username || partner.displayName || 'Friend';
    const partnerAvatar = partner.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${partnerName}`;

    // 2. Get UI elements
    const nameEl = document.getElementById('call-partner-name');
    const avatarEl = document.getElementById('call-partner-avatar');
    const statusEl = document.getElementById('call-status-label');
    const partnerDisplay = document.getElementById('call-partner-display');
    const remoteVideoWrap = document.getElementById('call-remote-video-wrap');
    const remotePartnerBg = document.getElementById('call-remote-partner-bg');
    const remoteVideoName = document.getElementById('call-partner-video-name');
    const localPip = document.getElementById('call-local-pip');
    const localVideo = document.getElementById('call-local-video');
    const micBtn = document.getElementById('call-toggle-mic-btn');
    const camBtn = document.getElementById('call-toggle-cam-btn');
    const endBtn = document.getElementById('call-end-btn');

    // Populate data
    if (nameEl) nameEl.textContent = partnerName;
    if (avatarEl) avatarEl.src = partnerAvatar;
    if (remotePartnerBg) remotePartnerBg.src = partnerAvatar;
    if (remoteVideoName) remoteVideoName.textContent = partnerName;

    // Reset controls state
    this.isMicMuted = false;
    this.isCamOff = false;
    this.callDuration = 0;
    if (this.callTimer) {
      clearInterval(this.callTimer);
      this.callTimer = null;
    }

    // Reset button icons
    if (micBtn) {
      micBtn.classList.remove('active-muted');
      const micOn = micBtn.querySelector('.icon-mic-on');
      const micOff = micBtn.querySelector('.icon-mic-off');
      if (micOn) micOn.style.display = 'block';
      if (micOff) micOff.style.display = 'none';
    }

    if (camBtn) {
      camBtn.classList.remove('active-off');
      const camOn = camBtn.querySelector('.icon-cam-on');
      const camOff = camBtn.querySelector('.icon-cam-off');
      if (camOn) camOn.style.display = 'block';
      if (camOff) camOff.style.display = 'none';
    }

    // 3. Display modal immediately
    modal.style.display = 'flex';
    modal.classList.add('active');
    document.body.classList.add('modal-open');

    // 4. Setup Mode Displays
    if (type === 'video') {
      if (partnerDisplay) partnerDisplay.style.display = 'none';
      if (remoteVideoWrap) remoteVideoWrap.style.display = 'flex';
      if (localPip) localPip.style.display = 'block';
      if (camBtn) camBtn.style.display = 'flex';
      if (statusEl) statusEl.textContent = 'Calling Aura HD Video...';

      // Start webcam preview asynchronously in background (do not block)
      if (localVideo) {
        this.callCamera.startCamera(localVideo, 'user', true).catch(err => {
          console.warn('[Call] Camera preview notice:', err);
        });
      }
    } else {
      if (partnerDisplay) partnerDisplay.style.display = 'flex';
      if (remoteVideoWrap) remoteVideoWrap.style.display = 'none';
      if (localPip) localPip.style.display = 'none';
      if (camBtn) camBtn.style.display = 'none';
      if (statusEl) statusEl.textContent = 'Calling audio...';

      // Request microphone in background (do not block)
      if (navigator.mediaDevices?.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
          this.callAudioStream = stream;
        }).catch(() => {});
      }
    }

    // 5. Start audio ringtone immediately
    this.callAudioSynth.startRinging();

    // 6. Connect after 2.4s
    const connectTimer = setTimeout(() => {
      this.callAudioSynth.playConnectedChime();
      if (statusEl) statusEl.textContent = '00:00 (Connected)';

      this.callTimer = setInterval(() => {
        this.callDuration++;
        if (statusEl) {
          statusEl.textContent = `${this.formatCallDuration(this.callDuration)} (Connected)`;
        }
      }, 1000);
    }, 2400);

    // 7. Mic Toggle Button
    if (micBtn) {
      micBtn.onclick = () => {
        this.isMicMuted = !this.isMicMuted;
        micBtn.classList.toggle('active-muted', this.isMicMuted);

        const micOn = micBtn.querySelector('.icon-mic-on');
        const micOff = micBtn.querySelector('.icon-mic-off');
        if (micOn) micOn.style.display = this.isMicMuted ? 'none' : 'block';
        if (micOff) micOff.style.display = this.isMicMuted ? 'block' : 'none';

        if (this.callCamera.stream) {
          this.callCamera.stream.getAudioTracks().forEach(t => t.enabled = !this.isMicMuted);
        }
        if (this.callAudioStream) {
          this.callAudioStream.getAudioTracks().forEach(t => t.enabled = !this.isMicMuted);
        }

        state.showToast(this.isMicMuted ? 'Microphone muted' : 'Microphone unmuted', 'info');
      };
    }

    // 8. Cam Toggle Button
    if (camBtn) {
      camBtn.onclick = () => {
        this.isCamOff = !this.isCamOff;
        camBtn.classList.toggle('active-off', this.isCamOff);

        const camOn = camBtn.querySelector('.icon-cam-on');
        const camOff = camBtn.querySelector('.icon-cam-off');
        if (camOn) camOn.style.display = this.isCamOff ? 'none' : 'block';
        if (camOff) camOff.style.display = this.isCamOff ? 'block' : 'none';

        if (this.callCamera.stream) {
          this.callCamera.stream.getVideoTracks().forEach(t => t.enabled = !this.isCamOff);
        }
        if (localVideo) {
          localVideo.style.opacity = this.isCamOff ? '0.1' : '1';
        }

        state.showToast(this.isCamOff ? 'Camera turned off' : 'Camera turned on', 'info');
      };
    }

    // 9. End Call Handler
    const endCall = async () => {
      clearTimeout(connectTimer);
      if (this.callTimer) {
        clearInterval(this.callTimer);
        this.callTimer = null;
      }

      this.callAudioSynth.playEndChime();
      this.callCamera.stopCamera();

      if (this.callAudioStream) {
        try {
          this.callAudioStream.getTracks().forEach(t => t.stop());
        } catch (_) {}
        this.callAudioStream = null;
      }

      modal.style.display = 'none';
      modal.classList.remove('active');
      document.body.classList.remove('modal-open');

      const durationStr = this.formatCallDuration(this.callDuration);
      const callLabel = type === 'video' ? '📹 Video call' : '📞 Audio call';
      const logMsg = `${callLabel} ended • ${durationStr}`;

      if (state.currentUser && partner.uid) {
        try {
          await firebaseService.sendMessage(state.currentUser.uid, partner.uid, logMsg);
        } catch (_) {}
      }
      state.showToast(`Call ended (${durationStr})`, 'info');
    };

    if (endBtn) {
      endBtn.onclick = endCall;
    }
  }

  async openNewMessageModal() {
    const modal = document.getElementById('new-msg-modal');
    const usersList = document.getElementById('new-msg-users-list');
    const searchInput = document.getElementById('new-msg-search-input');
    if (!modal || !usersList) return;

    modal.classList.add('active');

    let allUsers = firebaseService.getLocalUsers().filter(u => u.uid !== state.currentUser?.uid);
    if (allUsers.length === 0) {
      const remoteUsers = await firebaseService.apiGet('users');
      if (Array.isArray(remoteUsers)) {
        allUsers = remoteUsers.filter(u => u.uid !== state.currentUser?.uid);
        localStorage.setItem('aura_users', JSON.stringify(remoteUsers));
      }
    }

    const renderUsers = (query = '') => {
      const filtered = allUsers.filter(u =>
        u.username.toLowerCase().includes(query.toLowerCase()) ||
        (u.displayName || '').toLowerCase().includes(query.toLowerCase())
      );

      usersList.innerHTML = filtered.map(u => `
        <div class="user-row-item select-user-item" data-uid="${u.uid}">
          <div class="user-row-left">
            <img src="${u.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${u.username}`}" class="user-row-avatar" />
            <div class="user-row-meta">
              <span class="user-row-username">${u.username}</span>
              <span class="user-row-name">${u.displayName || ''}</span>
            </div>
          </div>
        </div>
      `).join('') || '<div class="no-users-found">No users found.</div>';

      usersList.querySelectorAll('.select-user-item').forEach(item => {
        item.onclick = () => {
          const user = allUsers.find(u => u.uid === item.dataset.uid);
          if (user) {
            modal.classList.remove('active');
            this.selectPartner(user);
          }
        };
      });
    };

    renderUsers();
    if (searchInput) {
      searchInput.value = '';
      searchInput.oninput = (e) => renderUsers(e.target.value.trim());
    }

    const closeBtn = document.getElementById('new-msg-close-btn');
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

  formatTime(timestamp) {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

export const directManager = new DirectManager();
