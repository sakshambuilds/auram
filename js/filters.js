/**
 * Aura - Instagram Filter & Image Adjustment Engine
 * Supports preset filters and real-time canvas rendering
 */

export const FILTER_PRESETS = [
  { id: 'normal', name: 'Normal', filter: 'none' },
  { id: 'clarendon', name: 'Clarendon', filter: 'contrast(1.2) saturate(1.25) brightness(1.05)' },
  { id: 'juno', name: 'Juno', filter: 'contrast(1.15) saturate(1.4) sepia(0.1)' },
  { id: 'ludwig', name: 'Ludwig', filter: 'contrast(1.05) saturate(1.1) brightness(1.05) sepia(0.08)' },
  { id: 'lark', name: 'Lark', filter: 'contrast(0.9) brightness(1.15) saturate(1.1)' },
  { id: 'valencia', name: 'Valencia', filter: 'sepia(0.25) contrast(1.08) brightness(1.08)' },
  { id: 'moon', name: 'Moon', filter: 'grayscale(1) contrast(1.1) brightness(1.1)' },
  { id: 'lofi', name: 'Lo-Fi', filter: 'saturate(1.4) contrast(1.35)' },
  { id: 'slumber', name: 'Slumber', filter: 'saturate(0.66) brightness(1.05) sepia(0.3)' },
  { id: 'aden', name: 'Aden', filter: 'hue-rotate(-20deg) contrast(0.9) saturate(0.85) brightness(1.2)' }
];

export class FilterEngine {
  /**
   * Generates CSS filter string combining preset and custom adjustments
   */
  static getFilterStyle(presetId, adjustments = {}) {
    const preset = FILTER_PRESETS.find(p => p.id === presetId) || FILTER_PRESETS[0];
    const baseFilter = preset.filter === 'none' ? '' : preset.filter;

    const brightness = adjustments.brightness ?? 100;
    const contrast = adjustments.contrast ?? 100;
    const saturation = adjustments.saturation ?? 100;
    const sepia = adjustments.sepia ?? 0;
    const blur = adjustments.blur ?? 0;

    const customFilters = [
      `brightness(${brightness}%)`,
      `contrast(${contrast}%)`,
      `saturate(${saturation}%)`,
      sepia > 0 ? `sepia(${sepia}%)` : '',
      blur > 0 ? `blur(${blur}px)` : ''
    ].filter(Boolean).join(' ');

    return `${baseFilter} ${customFilters}`.trim() || 'none';
  }

  /**
   * Render an image onto canvas with all filters applied and export as Blob
   */
  static async renderToCanvas(imageElement, presetId, adjustments = {}, width = null, height = null) {
    const canvas = document.createElement('canvas');
    const naturalW = imageElement.naturalWidth || imageElement.videoWidth || 1080;
    const naturalH = imageElement.naturalHeight || imageElement.videoHeight || 1080;

    canvas.width = width || naturalW;
    canvas.height = height || naturalH;

    const ctx = canvas.getContext('2d');
    const filterString = this.getFilterStyle(presetId, adjustments);

    ctx.filter = filterString;
    ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

    return canvas;
  }
}
