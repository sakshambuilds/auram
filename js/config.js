/**
 * ============================================================================
 * AURA / INSTAGRAM — CLOUD & BACKEND CONFIGURATION
 * ============================================================================
 * Put your free Firebase & Cloudinary keys here directly in the code!
 * If left empty, the app runs locally in your browser so you can test right away.
 */

export const CONFIG = {
  // 1. Google Firebase Configuration (Free Spark Plan)
  // Get these from: Firebase Console -> Project Settings -> Your Apps -> Web App
  firebase: {
    apiKey: "AIzaSyDPfs6w3CcpZx4oj8PHY22oljMOpErLbRg",
    authDomain: "studybuddyapp-1.firebaseapp.com",
    projectId: "studybuddyapp-1",
    storageBucket: "studybuddyapp-1.firebasestorage.app",
    messagingSenderId: "746290760117",
    appId: "1:746290760117:web:6a7bc3a66671d4747331fc"              // e.g. "1:1234567890:web:abcdef..."
  },

  // 2. Cloudinary Media Storage (Free Tier - 25GB)
  // Get these from: Cloudinary Dashboard -> Settings -> Upload -> Add Unsigned Upload Preset
  cloudinary: {
    cloudName: "m8qntrnn",          // e.g. "my-cloud-name"
    uploadPreset: "aura_unsigned"        // e.g. "my_unsigned_preset"
  },

  // Helper: Checks if live Firebase is configured with real keys
  isLiveFirebase() {
    return Boolean(this.firebase.apiKey && this.firebase.projectId);
  },

  // Helper: Checks if live Cloudinary is configured
  isLiveCloudinary() {
    return Boolean(this.cloudinary.cloudName && this.cloudinary.uploadPreset);
  }
};
