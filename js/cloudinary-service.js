/**
 * Aura - Cloudinary Media Upload Service
 * Direct unsigned uploads for images and videos with progress tracking
 */
import { CONFIG } from './config.js';

export class CloudinaryService {
  /**
   * Upload an image or video file/blob to Cloudinary
   * @param {File|Blob|string} file - File, Blob, or base64 data URL
   * @param {'image'|'video'|'auto'} resourceType - Type of resource
   * @param {Function} onProgress - Progress callback (percentage 0-100)
   * @returns {Promise<{url: string, secure_url: string, public_id: string, resource_type: string, duration?: number}>}
   */
  static async uploadMedia(file, resourceType = 'auto', onProgress = null) {
    if (!CONFIG.isLiveCloudinary()) {
      throw new Error('Cloudinary is not configured in js/config.js');
    }

    const { cloudName, uploadPreset } = CONFIG.cloudinary;
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

    const formData = new FormData();
    formData.append('upload_preset', uploadPreset);
    formData.append('file', file);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);

      if (onProgress && xhr.upload) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve({
              url: data.url,
              secure_url: data.secure_url,
              public_id: data.public_id,
              resource_type: data.resource_type || (resourceType === 'video' ? 'video' : 'image'),
              format: data.format,
              width: data.width,
              height: data.height,
              duration: data.duration
            });
          } catch (err) {
            reject(new Error('Failed to parse Cloudinary response'));
          }
        } else {
          try {
            const errData = JSON.parse(xhr.responseText);
            reject(new Error(errData.error?.message || `Cloudinary upload failed with status ${xhr.status}`));
          } catch (_) {
            reject(new Error(`Cloudinary upload failed with status ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error during Cloudinary upload'));
      xhr.ontimeout = () => reject(new Error('Cloudinary upload timed out'));

      xhr.send(formData);
    });
  }

  /**
   * Helper to convert a Canvas element to a Blob and upload to Cloudinary
   */
  static async uploadCanvas(canvas, onProgress = null, quality = 0.92) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            reject(new Error('Failed to convert canvas to blob'));
            return;
          }
          try {
            const result = await CloudinaryService.uploadMedia(blob, 'image', onProgress);
            resolve(result);
          } catch (e) {
            reject(e);
          }
        },
        'image/jpeg',
        quality
      );
    });
  }
}
