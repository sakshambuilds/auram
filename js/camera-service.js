/**
 * Aura - Live Camera & Media Capture Service
 * Provides webcam live stream, photo capture, and MediaRecorder for Reels and Stories
 */
export class CameraService {
  constructor() {
    this.stream = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
  }

  static isSupported() {
    return Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /**
   * Start live camera stream and bind to video element
   */
  async startCamera(videoElement, facingMode = 'user', withAudio = true) {
    this.stopCamera();

    const constraints = {
      video: {
        facingMode,
        width: { ideal: 1080 },
        height: { ideal: 1920 }
      },
      audio: withAudio
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoElement) {
        videoElement.srcObject = this.stream;
        await videoElement.play();
      }
      return this.stream;
    } catch (err) {
      console.warn('[Aura Camera] Could not start video with constraints, trying fallback:', err);
      // Fallback with basic constraints
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: withAudio });
        if (videoElement) {
          videoElement.srcObject = this.stream;
          await videoElement.play();
        }
        return this.stream;
      } catch (fallbackErr) {
        throw new Error('Camera access denied or unavailable: ' + fallbackErr.message);
      }
    }
  }

  /**
   * Stop active camera and audio tracks
   */
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  /**
   * Capture a still image from the camera stream
   * @returns {Blob}
   */
  takeSnapshot(videoElement, quality = 0.95) {
    if (!videoElement || !videoElement.videoWidth) {
      throw new Error('Video stream is not ready for capture');
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    const ctx = canvas.getContext('2d');
    // Mirror if facing user
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
    });
  }

  /**
   * Start video recording (for Reels & Stories)
   */
  startRecording(onTimeUpdate = null) {
    if (!this.stream) throw new Error('Camera stream is not active');

    this.recordedChunks = [];
    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4'
    ];

    let selectedMime = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';

    try {
      this.mediaRecorder = new MediaRecorder(this.stream, selectedMime ? { mimeType: selectedMime } : undefined);
    } catch (e) {
      this.mediaRecorder = new MediaRecorder(this.stream);
    }

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.isRecording = true;
    this.mediaRecorder.start(250); // chunks every 250ms

    const startTime = Date.now();
    if (onTimeUpdate) {
      this.timerInterval = setInterval(() => {
        if (!this.isRecording) {
          clearInterval(this.timerInterval);
          return;
        }
        const elapsedSec = (Date.now() - startTime) / 1000;
        onTimeUpdate(elapsedSec);
      }, 100);
    }
  }

  /**
   * Stop video recording and return blob
   */
  stopRecording() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        reject(new Error('MediaRecorder is not recording'));
        return;
      }

      this.isRecording = false;
      if (this.timerInterval) clearInterval(this.timerInterval);

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder.mimeType || 'video/webm';
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }
}

export const cameraService = new CameraService();
