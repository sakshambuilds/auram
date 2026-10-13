/**
 * Aura - Creation Studio (Posts, Reels & Stories)
 * Supports Drag & Drop, File Upload, Live Webcam Capture, Instagram Filters & Cloudinary Upload
 */
import { CloudinaryService } from './cloudinary-service.js';
import { firebaseService } from './firebase-service.js';
import { cameraService } from './camera-service.js';
import { FilterEngine, FILTER_PRESETS } from './filters.js';
import { state } from './state.js';

class CreateStudio {
  constructor() {
    this.mode = 'post'; // 'post' | 'reel' | 'story'
    this.step = 'source'; // 'source' | 'edit' | 'caption'
    this.selectedFile = null;
    this.mediaType = 'image'; // 'image' | 'video'
    this.activePreset = 'normal';
    this.adjustments = { brightness: 100, contrast: 100, saturation: 100, sepia: 0 };
    this.aspectRatio = 'square'; // 'square' | 'portrait' | 'original' | 'reel'
    this.isRecording = false;

    this.initListeners();
  }

  initListeners() {
    state.on('open:create-modal', ({ mode }) => {
      this.openModal(mode || 'post');
    });
  }

  openModal(initialMode = 'post') {
    this.mode = initialMode;
    this.step = 'source';
    this.selectedFile = null;
    this.mediaType = initialMode === 'reel' ? 'video' : 'image';
    this.activePreset = 'normal';
    this.adjustments = { brightness: 100, contrast: 100, saturation: 100, sepia: 0 };

    const modal = document.getElementById('create-modal');
    if (!modal) return;

    modal.classList.add('active');
    document.body.classList.add('modal-open');

    this.renderTabs();
    this.renderStep();
  }

  closeModal() {
    cameraService.stopCamera();
    const modal = document.getElementById('create-modal');
    if (modal) modal.classList.remove('active');
    document.body.classList.remove('modal-open');
  }

  renderTabs() {
    const tabs = document.querySelectorAll('.create-mode-tab');
    tabs.forEach(tab => {
      const tabMode = tab.dataset.mode;
      tab.classList.toggle('active', tabMode === this.mode);
      tab.onclick = () => {
        if (this.mode !== tabMode) {
          this.mode = tabMode;
          this.mediaType = tabMode === 'reel' ? 'video' : 'image';
          this.step = 'source';
          this.renderTabs();
          this.renderStep();
        }
      };
    });
  }

  renderStep() {
    const body = document.getElementById('create-modal-body');
    const headerTitle = document.getElementById('create-modal-title');
    const nextBtn = document.getElementById('create-modal-next');
    const backBtn = document.getElementById('create-modal-back');
    const closeBtn = document.getElementById('create-modal-close');

    if (!body) return;

    if (closeBtn) {
      closeBtn.onclick = () => this.closeModal();
    }

    // Mode title
    const modeLabels = { post: 'Create new post', reel: 'Create new Reel', story: 'Add to your story' };
    if (headerTitle) headerTitle.textContent = modeLabels[this.mode];

    backBtn.style.display = this.step === 'source' ? 'none' : 'flex';
    backBtn.onclick = () => {
      if (this.step === 'caption') this.step = 'edit';
      else if (this.step === 'edit') this.step = 'source';
      this.renderStep();
    };

    nextBtn.style.display = this.step === 'source' ? 'none' : 'flex';
    nextBtn.textContent = this.step === 'caption' ? 'Share' : 'Next';

    if (this.step === 'source') {
      this.renderSourceStep(body);
    } else if (this.step === 'edit') {
      this.renderEditStep(body);
      nextBtn.onclick = () => {
        this.step = 'caption';
        this.renderStep();
      };
    } else if (this.step === 'caption') {
      this.renderCaptionStep(body);
      nextBtn.onclick = () => {
        this.publish();
      };
    }
  }

  renderSourceStep(container) {
    container.innerHTML = `
      <div class="create-source-container">
        <!-- Drag & Drop Zone -->
        <div class="drop-zone" id="create-drop-zone">
          <div class="drop-zone-icons">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </div>
          <h4>Drag photos and videos here</h4>
          <p class="drop-zone-subtitle">High resolution photos and HD videos ready for Aura</p>
          <div class="source-buttons-row">
            <label class="aura-btn aura-btn-primary file-select-label">
              Select from device
              <input type="file" id="create-file-input" accept="${this.mode === 'reel' ? 'video/*' : 'image/*,video/*'}" style="display:none;" />
            </label>
            <button class="aura-btn aura-btn-secondary" id="create-camera-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
              Use Live Camera
            </button>
          </div>
        </div>

        <!-- Live Camera Stream View (Hidden until camera button clicked) -->
        <div class="camera-stage" id="create-camera-stage" style="display:none;">
          <video id="create-camera-video" playsinline muted autoplay></video>
          <div class="camera-controls">
            ${this.mode === 'reel' ? `
              <button class="camera-action-btn record-video-btn" id="cam-record-btn" aria-label="Record Video">
                <div class="record-dot"></div>
              </button>
              <div class="record-timer" id="cam-record-timer" style="display:none;">00:00</div>
            ` : `
              <button class="camera-action-btn snap-photo-btn" id="cam-snap-btn" aria-label="Take Photo"></button>
            `}
            <button class="camera-action-btn cam-close-btn" id="cam-stop-btn" aria-label="Back">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    const fileInput = document.getElementById('create-file-input');
    const dropZone = document.getElementById('create-drop-zone');
    const cameraBtn = document.getElementById('create-camera-btn');
    const cameraStage = document.getElementById('create-camera-stage');
    const cameraVideo = document.getElementById('create-camera-video');

    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) this.handleSelectedFile(file);
    };

    dropZone.ondragover = (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-active');
    };
    dropZone.ondragleave = () => dropZone.classList.remove('drag-active');
    dropZone.ondrop = (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-active');
      const file = e.dataTransfer.files[0];
      if (file) this.handleSelectedFile(file);
    };

    // Live Camera Setup
    cameraBtn.onclick = async () => {
      try {
        dropZone.style.display = 'none';
        cameraStage.style.display = 'flex';
        await cameraService.startCamera(cameraVideo, 'user', this.mode === 'reel');
        this.setupCameraControls(cameraVideo);
      } catch (err) {
        state.showToast('Camera error: ' + err.message, 'error');
        dropZone.style.display = 'flex';
        cameraStage.style.display = 'none';
      }
    };
  }

  setupCameraControls(video) {
    const snapBtn = document.getElementById('cam-snap-btn');
    const recordBtn = document.getElementById('cam-record-btn');
    const recordTimer = document.getElementById('cam-record-timer');
    const stopBtn = document.getElementById('cam-stop-btn');

    if (stopBtn) {
      stopBtn.onclick = () => {
        cameraService.stopCamera();
        this.renderStep();
      };
    }

    if (snapBtn) {
      snapBtn.onclick = async () => {
        const blob = await cameraService.takeSnapshot(video);
        cameraService.stopCamera();
        this.handleSelectedFile(blob, 'image');
      };
    }

    if (recordBtn) {
      recordBtn.onclick = async () => {
        if (!this.isRecording) {
          this.isRecording = true;
          recordBtn.classList.add('recording');
          if (recordTimer) recordTimer.style.display = 'block';

          cameraService.startRecording((seconds) => {
            if (recordTimer) {
              const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
              const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
              recordTimer.textContent = `${mins}:${secs}`;
            }
          });
        } else {
          this.isRecording = false;
          recordBtn.classList.remove('recording');
          const blob = await cameraService.stopRecording();
          cameraService.stopCamera();
          this.handleSelectedFile(blob, 'video');
        }
      };
    }
  }

  handleSelectedFile(file, forcedType = null) {
    this.selectedFile = file;
    const isVideo = forcedType === 'video' || file.type.startsWith('video/');
    this.mediaType = isVideo ? 'video' : 'image';

    // Move to Edit step
    this.step = 'edit';
    this.renderStep();
  }

  renderEditStep(container) {
    const fileUrl = URL.createObjectURL(this.selectedFile);

    container.innerHTML = `
      <div class="create-edit-layout">
        <!-- Media Preview Stage -->
        <div class="edit-media-stage ${this.aspectRatio}">
          ${this.mediaType === 'video' ? `
            <video id="edit-preview-video" src="${fileUrl}" loop controls autoplay></video>
          ` : `
            <img id="edit-preview-img" src="${fileUrl}" alt="Preview" />
          `}
        </div>

        <!-- Edit Sidebar: Filters & Adjustments -->
        <div class="edit-sidebar">
          <div class="edit-tabs-row">
            <button class="edit-subtab active" id="tab-filters">Filters</button>
            <button class="edit-subtab" id="tab-adjustments">Adjustments</button>
          </div>

          <!-- Filters Preset Row -->
          <div class="filters-panel" id="panel-filters">
            <div class="presets-grid">
              ${FILTER_PRESETS.map(preset => `
                <div class="filter-chip ${preset.id === this.activePreset ? 'active' : ''}" data-preset="${preset.id}">
                  <div class="filter-thumb-preview" style="filter: ${preset.filter}">
                    ${this.mediaType === 'video' ? '🎬' : `<img src="${fileUrl}" />`}
                  </div>
                  <span class="filter-name">${preset.name}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Adjustments Sliders Panel -->
          <div class="adjustments-panel" id="panel-adjustments" style="display:none;">
            <div class="slider-group">
              <div class="slider-header">
                <span>Brightness</span>
                <span id="val-brightness">${this.adjustments.brightness}%</span>
              </div>
              <input type="range" min="50" max="150" value="${this.adjustments.brightness}" id="slide-brightness" class="aura-slider" />
            </div>

            <div class="slider-group">
              <div class="slider-header">
                <span>Contrast</span>
                <span id="val-contrast">${this.adjustments.contrast}%</span>
              </div>
              <input type="range" min="50" max="150" value="${this.adjustments.contrast}" id="slide-contrast" class="aura-slider" />
            </div>

            <div class="slider-group">
              <div class="slider-header">
                <span>Saturation</span>
                <span id="val-saturation">${this.adjustments.saturation}%</span>
              </div>
              <input type="range" min="0" max="200" value="${this.adjustments.saturation}" id="slide-saturation" class="aura-slider" />
            </div>

            <div class="slider-group">
              <div class="slider-header">
                <span>Warmth / Sepia</span>
                <span id="val-sepia">${this.adjustments.sepia}%</span>
              </div>
              <input type="range" min="0" max="100" value="${this.adjustments.sepia}" id="slide-sepia" class="aura-slider" />
            </div>
          </div>
        </div>
      </div>
    `;

    const imgPreview = document.getElementById('edit-preview-img');
    const videoPreview = document.getElementById('edit-preview-video');
    const targetElement = imgPreview || videoPreview;

    const applyLiveFilter = () => {
      const style = FilterEngine.getFilterStyle(this.activePreset, this.adjustments);
      if (targetElement) targetElement.style.filter = style;
    };

    applyLiveFilter();

    // Tab switching
    const tabFilters = document.getElementById('tab-filters');
    const tabAdj = document.getElementById('tab-adjustments');
    const panelFilters = document.getElementById('panel-filters');
    const panelAdj = document.getElementById('panel-adjustments');

    tabFilters.onclick = () => {
      tabFilters.classList.add('active');
      tabAdj.classList.remove('active');
      panelFilters.style.display = 'block';
      panelAdj.style.display = 'none';
    };

    tabAdj.onclick = () => {
      tabAdj.classList.add('active');
      tabFilters.classList.remove('active');
      panelAdj.style.display = 'block';
      panelFilters.style.display = 'none';
    };

    // Filter Chips
    const chips = container.querySelectorAll('.filter-chip');
    chips.forEach(chip => {
      chip.onclick = () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activePreset = chip.dataset.preset;
        applyLiveFilter();
      };
    });

    // Adjustment sliders
    const bindSlider = (id, key, unit = '%') => {
      const slider = document.getElementById('slide-' + id);
      const valLabel = document.getElementById('val-' + id);
      if (slider) {
        slider.oninput = (e) => {
          this.adjustments[key] = parseInt(e.target.value);
          if (valLabel) valLabel.textContent = e.target.value + unit;
          applyLiveFilter();
        };
      }
    };

    bindSlider('brightness', 'brightness');
    bindSlider('contrast', 'contrast');
    bindSlider('saturation', 'saturation');
    bindSlider('sepia', 'sepia');
  }

  renderCaptionStep(container) {
    const fileUrl = URL.createObjectURL(this.selectedFile);
    const currentUser = state.currentUser;

    container.innerHTML = `
      <div class="create-caption-layout">
        <div class="caption-media-preview">
          ${this.mediaType === 'video' ? `
            <video src="${fileUrl}" muted autoplay loop class="caption-thumb" style="filter: ${FilterEngine.getFilterStyle(this.activePreset, this.adjustments)}"></video>
          ` : `
            <img src="${fileUrl}" class="caption-thumb" style="filter: ${FilterEngine.getFilterStyle(this.activePreset, this.adjustments)}" />
          `}
        </div>

        <div class="caption-form-section">
          <div class="caption-user-header">
            <img src="${currentUser?.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${currentUser?.username}`}" class="caption-user-avatar" />
            <span class="caption-user-name">${currentUser?.username || 'you'}</span>
          </div>

          <textarea id="create-caption-input" class="caption-textarea" placeholder="Write a caption... (use #hashtags and @mentions)" rows="5"></textarea>

          <div class="caption-meta-fields">
            <div class="meta-field-row">
              <input type="text" id="create-location-input" class="aura-input" placeholder="Add location (e.g., Tokyo, Japan)" />
            </div>

            ${this.mode === 'reel' ? `
              <div class="meta-field-row">
                <input type="text" id="create-audio-input" class="aura-input" placeholder="Audio Title (e.g., Original audio - ${currentUser?.username})" />
              </div>
            ` : ''}
          </div>

          <!-- Upload Progress Bar (hidden by default) -->
          <div class="upload-progress-container" id="upload-progress-box" style="display:none;">
            <div class="progress-bar-track">
              <div class="progress-bar-fill" id="upload-progress-fill"></div>
            </div>
            <span class="upload-status-text" id="upload-status-label">Uploading to Cloudinary... 0%</span>
          </div>
        </div>
      </div>
    `;
  }

  async publish() {
    const currentUser = state.currentUser;
    if (!currentUser) {
      state.showToast('Please sign in to publish', 'error');
      return;
    }

    const captionInput = document.getElementById('create-caption-input');
    const locationInput = document.getElementById('create-location-input');
    const audioInput = document.getElementById('create-audio-input');
    const progressBox = document.getElementById('upload-progress-box');
    const progressFill = document.getElementById('upload-progress-fill');
    const progressLabel = document.getElementById('upload-status-label');
    const nextBtn = document.getElementById('create-modal-next');

    if (progressBox) progressBox.style.display = 'block';
    if (nextBtn) nextBtn.disabled = true;

    try {
      let uploadMedia = this.selectedFile;

      // If it's an image with filters or adjustments, render filtered canvas
      if (this.mediaType === 'image') {
        if (progressLabel) progressLabel.textContent = 'Applying filters and rendering...';
        const img = new Image();
        img.src = URL.createObjectURL(this.selectedFile);
        await new Promise(r => img.onload = r);

        const canvas = await FilterEngine.renderToCanvas(img, this.activePreset, this.adjustments);
        uploadMedia = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92));
      }

      // Upload to Cloudinary with real progress tracking
      if (progressLabel) progressLabel.textContent = 'Uploading to Cloudinary CDN...';
      const uploadResult = await CloudinaryService.uploadMedia(
        uploadMedia,
        this.mediaType === 'video' ? 'video' : 'image',
        (percent) => {
          if (progressFill) progressFill.style.width = `${percent}%`;
          if (progressLabel) progressLabel.textContent = `Uploading to Cloudinary CDN... ${percent}%`;
        }
      );

      const mediaUrl = uploadResult.secure_url || uploadResult.url;
      const caption = captionInput ? captionInput.value.trim() : '';
      const location = locationInput ? locationInput.value.trim() : '';
      const audioName = audioInput ? audioInput.value.trim() : '';

      if (progressLabel) progressLabel.textContent = 'Saving to Aura...';

      if (this.mode === 'post') {
        await firebaseService.createPost({
          userId: currentUser.uid,
          username: currentUser.username,
          userPhoto: currentUser.photoURL,
          mediaUrl,
          mediaType: this.mediaType,
          caption,
          location
        });
        state.showToast('Post published successfully!', 'success');
        state.setView('feed');
      } else if (this.mode === 'reel') {
        await firebaseService.createReel({
          userId: currentUser.uid,
          username: currentUser.username,
          userPhoto: currentUser.photoURL,
          videoUrl: mediaUrl,
          caption,
          audioName: audioName || `Original audio - ${currentUser.username}`
        });
        state.showToast('Reel shared!', 'success');
        this.closeModal();
        if (window.location.pathname.includes('reels')) {
          setTimeout(() => window.location.reload(), 400);
        } else {
          window.location.href = 'reels.html';
        }
        return;
      } else if (this.mode === 'story') {
        await firebaseService.createStory({
          userId: currentUser.uid,
          username: currentUser.username,
          userPhoto: currentUser.photoURL,
          mediaUrl,
          mediaType: this.mediaType,
          caption
        });
        state.showToast('Story added!', 'success');
        state.setView('feed');
      }

      this.closeModal();
    } catch (err) {
      console.error('Publish error:', err);
      state.showToast('Failed to publish: ' + err.message, 'error');
      if (nextBtn) nextBtn.disabled = false;
    }
  }
}

export const createStudio = new CreateStudio();
