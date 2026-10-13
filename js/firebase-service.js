/**
 * Aura - Firebase & Pure Client-Side Realtime Synchronization Service
 * 100% Pure HTML, CSS, JavaScript (No Node.js / backend server required).
 * Provides Authentication, Cloud Persistence, Cross-Device Sync & Resilient Multi-User Storage.
 * Connects directly to Google Firebase (Firestore + Auth) and Cloudinary from the browser.
 */
import { CONFIG } from './config.js';

// Import Firebase SDK directly via official ESM CDN (Runs in browser with 0 dependencies)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Initial Seed Users (preserved from local state)
const SEED_USERS = [
  {
    uid: "bRo7d8jzbqOiQH3kmRZSLiM8uV62",
    email: "saksham@aura.app",
    username: "saksham",
    displayName: "saksham",
    photoURL: "https://res.cloudinary.com/m8qntrnn/image/upload/v1791815803/ykf0ye2c7qeqb2y4fov9.png",
    bio: "✨ Aura Creator",
    website: "",
    followers: [],
    following: ["UmPwq0pkT9NVp0HWN6qNk6GekZo2"],
    savedPosts: [],
    createdAt: 1791815486515,
    updatedAt: 1791817590402
  },
  {
    uid: "UmPwq0pkT9NVp0HWN6qNk6GekZo2",
    email: "saksham2@aura.app",
    username: "saksham2",
    displayName: "saksham2",
    photoURL: "https://api.dicebear.com/7.x/adventurer/svg?seed=saksham2",
    bio: "✨ Aura Creator",
    website: "",
    followers: ["bRo7d8jzbqOiQH3kmRZSLiM8uV62"],
    following: [],
    savedPosts: [],
    createdAt: 1791815317719,
    updatedAt: 1791817590704
  }
];

class FirebaseService {
  constructor() {
    this.app = null;
    this.auth = null;
    this.db = null;
    this.isInitialized = false;
    this.syncChannel = null;
    this.listeners = new Map();
    this.unsubscribeFirestore = [];

    this.init();
  }

  init() {
    // 1. Seed initial local storage if clean state
    this.seedInitialData();

    // 2. Initialize Firebase Client SDK if configured
    try {
      if (CONFIG.isLiveFirebase()) {
        this.app = initializeApp(CONFIG.firebase);
        this.auth = getAuth(this.app);
        this.db = getFirestore(this.app);
        this.isInitialized = true;
        console.log('[Aura] Firebase initialized successfully directly from browser.');

        // 3. Connect real-time Firestore collection listeners
        this.initFirestoreRealtime();
      }
    } catch (err) {
      console.warn('[Aura] Firebase initialization notice (running offline/local mode):', err);
    }

    // 4. Set up cross-tab broadcast channel for instant multi-tab sync on same device
    try {
      this.syncChannel = new BroadcastChannel('aura_sync_channel');
      this.syncChannel.onmessage = (event) => {
        if (event.data?.type && this.listeners.has(event.data.type)) {
          const cbs = this.listeners.get(event.data.type);
          cbs.forEach(cb => cb(event.data.payload));
        }
      };
    } catch (e) {
      console.warn('[Aura] BroadcastChannel notice:', e);
    }
  }

  seedInitialData() {
    try {
      const existingUsers = localStorage.getItem('aura_users');
      if (!existingUsers || JSON.parse(existingUsers).length === 0) {
        localStorage.setItem('aura_users', JSON.stringify(SEED_USERS));
      }
    } catch (_) {}
  }

  // ==========================================
  // REAL-TIME FIRESTORE EVENT STREAM
  // ==========================================

  initFirestoreRealtime() {
    if (!this.db) return;

    try {
      // 1. Live Posts Realtime Stream
      const postsQuery = query(collection(this.db, 'posts'), orderBy('createdAt', 'desc'));
      const unsubPosts = onSnapshot(postsQuery, (snapshot) => {
        const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (posts.length > 0) {
          localStorage.setItem('aura_posts', JSON.stringify(posts));
          this.emitLocal('POSTS_UPDATED', posts);
          this.broadcast('POSTS_UPDATED', posts);
        }
      }, (err) => console.warn('[Aura Firestore] Posts stream notice:', err.message));
      this.unsubscribeFirestore.push(unsubPosts);

      // 2. Live Reels Realtime Stream
      const reelsQuery = query(collection(this.db, 'reels'), orderBy('createdAt', 'desc'));
      const unsubReels = onSnapshot(reelsQuery, (snapshot) => {
        const reels = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (reels.length > 0) {
          localStorage.setItem('aura_reels', JSON.stringify(reels));
          this.emitLocal('REELS_UPDATED', reels);
          this.broadcast('REELS_UPDATED', reels);
        }
      }, (err) => console.warn('[Aura Firestore] Reels stream notice:', err.message));
      this.unsubscribeFirestore.push(unsubReels);

      // 3. Live Stories Realtime Stream
      const storiesQuery = query(collection(this.db, 'stories'));
      const unsubStories = onSnapshot(storiesQuery, (snapshot) => {
        const now = Date.now();
        const stories = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(s => (s.expiresAt || 0) > now);
        if (stories.length > 0) {
          localStorage.setItem('aura_stories', JSON.stringify(stories));
          this.emitLocal('STORIES_UPDATED', stories);
          this.broadcast('STORIES_UPDATED', stories);
        }
      }, (err) => console.warn('[Aura Firestore] Stories stream notice:', err.message));
      this.unsubscribeFirestore.push(unsubStories);

      // 4. Live Messages Realtime Stream
      const messagesQuery = query(collection(this.db, 'messages'));
      const unsubMessages = onSnapshot(messagesQuery, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (messages.length > 0) {
          localStorage.setItem('aura_messages', JSON.stringify(messages));
          this.emitLocal('MESSAGES_UPDATED', messages);
          this.broadcast('MESSAGES_UPDATED', messages);
        }
      }, (err) => console.warn('[Aura Firestore] Messages stream notice:', err.message));
      this.unsubscribeFirestore.push(unsubMessages);

      // 5. Live Users Realtime Stream
      const usersQuery = query(collection(this.db, 'users'));
      const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
        const users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
        if (users.length > 0) {
          localStorage.setItem('aura_users', JSON.stringify(users));
          this.emitLocal('USERS_UPDATED', users);
          this.broadcast('USERS_UPDATED', users);
        }
      }, (err) => console.warn('[Aura Firestore] Users stream notice:', err.message));
      this.unsubscribeFirestore.push(unsubUsers);
    } catch (e) {
      console.warn('[Aura] Firestore realtime setup notice:', e);
    }
  }

  // Broadcast event across open tabs
  broadcast(type, payload) {
    if (this.syncChannel) {
      try {
        this.syncChannel.postMessage({ type, payload });
      } catch (_) {}
    }
  }

  // Internal subscriber emit
  emitLocal(type, payload) {
    if (this.listeners.has(type)) {
      const cbs = this.listeners.get(type);
      cbs.forEach(cb => {
        try { cb(payload); } catch (err) { console.error(err); }
      });
    }
  }

  // Subscribe to changes
  subscribe(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(callback);
    return () => this.listeners.get(type)?.delete(callback);
  }

  // ==========================================
  // AUTHENTICATION & MULTI-USER PROFILES
  // ==========================================

  onAuthState(callback) {
    if (this.auth) {
      return onAuthStateChanged(this.auth, async (firebaseUser) => {
        if (firebaseUser) {
          const userProfile = await this.getUserProfile(firebaseUser.uid) || {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
            username: (firebaseUser.displayName || firebaseUser.email.split('@')[0]).toLowerCase().replace(/[^a-z0-9_]/g, ''),
            photoURL: firebaseUser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${firebaseUser.uid}`,
            bio: '✨ Exploring the Aura community',
            website: '',
            followers: [],
            following: [],
            savedPosts: [],
            createdAt: Date.now()
          };
          this.setLocalCurrentUser(userProfile);
          callback(userProfile);
        } else {
          const localUser = this.getLocalCurrentUser();
          callback(localUser);
        }
      });
    } else {
      const localUser = this.getLocalCurrentUser();
      callback(localUser);
      return () => {};
    }
  }

  async signUp(email, password, username, displayName) {
    const cleanUsername = (username || email.split('@')[0]).toLowerCase().replace(/[^a-z0-9_]/g, '');
    const cleanDisplayName = displayName || username || email.split('@')[0];
    const defaultAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${cleanUsername}`;

    let uid = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    let authUser = null;

    if (this.auth) {
      try {
        const cred = await createUserWithEmailAndPassword(this.auth, email, password);
        authUser = cred.user;
        uid = authUser.uid;
        await updateProfile(authUser, {
          displayName: cleanDisplayName,
          photoURL: defaultAvatar
        });
      } catch (authErr) {
        console.warn('[Aura] Firebase auth notice:', authErr.message);
      }
    }

    const newProfile = {
      uid,
      email,
      username: cleanUsername,
      displayName: cleanDisplayName,
      photoURL: defaultAvatar,
      bio: '✨ Hello Aura! Welcome to my profile.',
      website: '',
      followers: [],
      following: [],
      savedPosts: [],
      createdAt: Date.now()
    };

    // Save to Firestore and local storage
    await this.saveUserProfile(newProfile);
    this.setLocalCurrentUser(newProfile);
    this.broadcast('USER_UPDATED', newProfile);
    return newProfile;
  }

  async signIn(email, password) {
    // 1. Try Firebase Auth if configured
    if (this.auth) {
      try {
        const cred = await signInWithEmailAndPassword(this.auth, email, password);
        let profile = await this.getUserProfile(cred.user.uid);
        if (!profile) {
          profile = {
            uid: cred.user.uid,
            email: cred.user.email,
            username: (cred.user.displayName || cred.user.email.split('@')[0]).toLowerCase().replace(/[^a-z0-9_]/g, ''),
            displayName: cred.user.displayName || cred.user.email.split('@')[0],
            photoURL: cred.user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${cred.user.uid}`,
            bio: '✨ Living in the moment',
            website: '',
            followers: [],
            following: [],
            savedPosts: [],
            createdAt: Date.now()
          };
          await this.saveUserProfile(profile);
        }
        this.setLocalCurrentUser(profile);
        return profile;
      } catch (authErr) {
        console.warn('[Aura] Firebase signIn notice:', authErr.message);
      }
    }

    // 2. Check local users database
    const users = this.getLocalUsers();
    const match = users.find(u => u.email === email || u.username === email);
    if (match) {
      this.setLocalCurrentUser(match);
      return match;
    }

    throw new Error('Account not found. Please check your credentials or sign up.');
  }

  async signOut() {
    if (this.auth) {
      try { await signOut(this.auth); } catch (_) {}
    }
    this.setLocalCurrentUser(null);
    this.broadcast('USER_LOGOUT', null);
  }

  // ==========================================
  // USER PROFILES
  // ==========================================

  async getUserProfile(uid) {
    if (!uid) return null;

    // 1. Check Firestore if live
    if (this.db) {
      try {
        const docRef = doc(this.db, 'users', uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const profile = { uid, ...snap.data() };
          // Cache locally
          const users = this.getLocalUsers();
          const idx = users.findIndex(u => u.uid === uid);
          if (idx >= 0) users[idx] = profile; else users.push(profile);
          localStorage.setItem('aura_users', JSON.stringify(users));
          return profile;
        }
      } catch (_) {}
    }

    // 2. Fallback to local users
    const users = this.getLocalUsers();
    return users.find(u => u.uid === uid || u.username === uid) || null;
  }

  async saveUserProfile(profile) {
    if (!profile || !profile.uid) return;

    // 1. Persist to Firestore if available
    if (this.db) {
      try {
        await setDoc(doc(this.db, 'users', profile.uid), profile, { merge: true });
      } catch (_) {}
    }

    // 2. Update local cache
    const users = this.getLocalUsers();
    const idx = users.findIndex(u => u.uid === profile.uid);
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...profile };
    } else {
      users.push(profile);
    }
    localStorage.setItem('aura_users', JSON.stringify(users));

    const cur = this.getLocalCurrentUser();
    if (cur && cur.uid === profile.uid) {
      this.setLocalCurrentUser({ ...cur, ...profile });
    }

    this.emitLocal('USER_UPDATED', profile);
    this.broadcast('USER_UPDATED', profile);
  }

  async updateUserProfile(uid, updates) {
    const existing = await this.getUserProfile(uid) || {};
    const updated = { ...existing, ...updates, uid, updatedAt: Date.now() };
    await this.saveUserProfile(updated);

    if (this.auth?.currentUser && this.auth.currentUser.uid === uid) {
      try {
        await updateProfile(this.auth.currentUser, {
          displayName: updated.displayName,
          photoURL: updated.photoURL
        });
      } catch (_) {}
    }

    this.emitLocal('USER_UPDATED', updated);
    this.broadcast('USER_UPDATED', updated);
    return updated;
  }

  // ==========================================
  // POSTS
  // ==========================================

  async createPost(postData) {
    const post = {
      id: 'post_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      likes: [],
      comments: [],
      savedBy: [],
      createdAt: Date.now(),
      ...postData
    };

    // 1. Persist to Firestore if available
    if (this.db) {
      try {
        await setDoc(doc(this.db, 'posts', post.id), post);
      } catch (err) {
        console.warn('[Aura] Firestore post save notice:', err);
      }
    }

    // 2. Update local cache
    const posts = this.getLocalPosts();
    posts.unshift(post);
    localStorage.setItem('aura_posts', JSON.stringify(posts));

    this.emitLocal('POSTS_UPDATED', posts);
    this.broadcast('POSTS_UPDATED', posts);
    return post;
  }

  async getPosts() {
    // 1. Try Firestore
    if (this.db) {
      try {
        const postsRef = collection(this.db, 'posts');
        const q = query(postsRef, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          localStorage.setItem('aura_posts', JSON.stringify(list));
          return list;
        }
      } catch (_) {}
    }

    // 2. Fallback to local cache
    return this.getLocalPosts();
  }

  async deletePost(postId, userId = null) {
    if (!userId) {
      if (this.auth?.currentUser?.uid) {
        userId = this.auth.currentUser.uid;
      } else {
        const stored = this.getLocalCurrentUser();
        if (stored?.uid) userId = stored.uid;
      }
    }
    if (!userId) {
      throw new Error('Authentication required to delete post');
    }

    // Verify ownership against cached post
    const cachedPost = this.getLocalPosts().find(p => p.id === postId);
    if (cachedPost && cachedPost.userId && cachedPost.userId !== userId) {
      throw new Error("Forbidden: You cannot delete another user's post");
    }

    // 1. Delete from Firestore if available
    if (this.db) {
      try { await deleteDoc(doc(this.db, 'posts', postId)); } catch (_) {}
    }

    // 2. Delete from local cache
    const posts = this.getLocalPosts().filter(p => p.id !== postId);
    localStorage.setItem('aura_posts', JSON.stringify(posts));
    this.emitLocal('POSTS_UPDATED', posts);
    this.broadcast('POSTS_UPDATED', posts);
    return true;
  }

  async toggleLikePost(postId, userId) {
    const posts = this.getLocalPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return { liked: false, count: 0 };

    if (!Array.isArray(post.likes)) post.likes = [];
    const idx = post.likes.indexOf(userId);
    let liked = false;
    if (idx >= 0) {
      post.likes.splice(idx, 1);
      liked = false;
    } else {
      post.likes.push(userId);
      liked = true;
    }

    if (this.db) {
      try {
        await updateDoc(doc(this.db, 'posts', postId), { likes: post.likes });
      } catch (_) {}
    }

    localStorage.setItem('aura_posts', JSON.stringify(posts));
    this.emitLocal('POSTS_UPDATED', posts);
    this.broadcast('POSTS_UPDATED', posts);
    return { liked, count: post.likes.length, post };
  }

  async addComment(postId, commentData) {
    const commentPayload = {
      id: 'cmt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      createdAt: Date.now(),
      likes: [],
      ...commentData
    };

    const posts = this.getLocalPosts();
    const post = posts.find(p => p.id === postId);
    if (post) {
      if (!Array.isArray(post.comments)) post.comments = [];
      post.comments.push(commentPayload);
      localStorage.setItem('aura_posts', JSON.stringify(posts));

      if (this.db) {
        try {
          await updateDoc(doc(this.db, 'posts', postId), { comments: post.comments });
        } catch (_) {}
      }
    }

    this.emitLocal('POSTS_UPDATED', posts);
    this.broadcast('POSTS_UPDATED', posts);
    return commentPayload;
  }

  async toggleSavePost(postId, userId) {
    const user = await this.getUserProfile(userId);
    if (!user) return false;

    if (!Array.isArray(user.savedPosts)) user.savedPosts = [];
    const idx = user.savedPosts.indexOf(postId);
    let saved = false;
    if (idx >= 0) {
      user.savedPosts.splice(idx, 1);
      saved = false;
    } else {
      user.savedPosts.push(postId);
      saved = true;
    }

    await this.saveUserProfile(user);
    this.emitLocal('USER_UPDATED', user);
    this.broadcast('USER_UPDATED', user);
    return saved;
  }

  // ==========================================
  // REELS
  // ==========================================

  async createReel(reelData) {
    const reel = {
      id: 'reel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      likes: [],
      comments: [],
      shares: 0,
      createdAt: Date.now(),
      ...reelData
    };

    // 1. Persist to Firestore if available
    if (this.db) {
      try {
        await setDoc(doc(this.db, 'reels', reel.id), reel);
      } catch (err) {
        console.warn('[Aura] Firestore reel save notice:', err);
      }
    }

    // 2. Update local cache
    const reels = this.getLocalReels();
    reels.unshift(reel);
    localStorage.setItem('aura_reels', JSON.stringify(reels));

    this.emitLocal('REELS_UPDATED', reels);
    this.broadcast('REELS_UPDATED', reels);
    return reel;
  }

  async getReels() {
    // 1. Try Firestore
    if (this.db) {
      try {
        const reelsRef = collection(this.db, 'reels');
        const q = query(reelsRef, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          localStorage.setItem('aura_reels', JSON.stringify(list));
          return list;
        }
      } catch (_) {}
    }

    // 2. Fallback to local cache
    return this.getLocalReels();
  }

  async deleteReel(reelId, userId = null) {
    if (!userId) {
      if (this.auth?.currentUser?.uid) {
        userId = this.auth.currentUser.uid;
      } else {
        const stored = this.getLocalCurrentUser();
        if (stored?.uid) userId = stored.uid;
      }
    }
    if (!userId) {
      throw new Error('Authentication required to delete reel');
    }

    // Verify ownership against cached reel
    const cachedReel = this.getLocalReels().find(r => r.id === reelId);
    if (cachedReel && cachedReel.userId && cachedReel.userId !== userId) {
      throw new Error("Forbidden: You cannot delete another user's reel");
    }

    // 1. Delete from Firestore if available
    if (this.db) {
      try { await deleteDoc(doc(this.db, 'reels', reelId)); } catch (_) {}
    }

    // 2. Delete from local cache
    const reels = this.getLocalReels().filter(r => r.id !== reelId);
    localStorage.setItem('aura_reels', JSON.stringify(reels));
    this.emitLocal('REELS_UPDATED', reels);
    this.broadcast('REELS_UPDATED', reels);
    return true;
  }

  async toggleLikeReel(reelId, userId) {
    const reels = this.getLocalReels();
    const reel = reels.find(r => r.id === reelId);
    if (!reel) return { liked: false, count: 0 };

    if (!Array.isArray(reel.likes)) reel.likes = [];
    const idx = reel.likes.indexOf(userId);
    let liked = false;
    if (idx >= 0) {
      reel.likes.splice(idx, 1);
      liked = false;
    } else {
      reel.likes.push(userId);
      liked = true;
    }

    if (this.db) {
      try {
        await updateDoc(doc(this.db, 'reels', reelId), { likes: reel.likes });
      } catch (_) {}
    }

    localStorage.setItem('aura_reels', JSON.stringify(reels));
    this.emitLocal('REELS_UPDATED', reels);
    this.broadcast('REELS_UPDATED', reels);
    return { liked, count: reel.likes.length, reel };
  }

  async addReelComment(reelId, commentData) {
    const commentPayload = {
      id: 'cmt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      createdAt: Date.now(),
      likes: [],
      ...commentData
    };

    const reels = this.getLocalReels();
    const reel = reels.find(r => r.id === reelId);
    if (reel) {
      if (!Array.isArray(reel.comments)) reel.comments = [];
      reel.comments.push(commentPayload);
      localStorage.setItem('aura_reels', JSON.stringify(reels));

      if (this.db) {
        try {
          await updateDoc(doc(this.db, 'reels', reelId), { comments: reel.comments });
        } catch (_) {}
      }
    }

    this.emitLocal('REELS_UPDATED', reels);
    this.broadcast('REELS_UPDATED', reels);
    return commentPayload;
  }

  // ==========================================
  // STORIES
  // ==========================================

  async createStory(storyData) {
    const story = {
      id: 'story_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      viewers: [],
      reactions: [],
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      ...storyData
    };

    if (this.db) {
      try {
        await setDoc(doc(this.db, 'stories', story.id), story);
      } catch (_) {}
    }

    const stories = this.getLocalStories();
    stories.push(story);
    localStorage.setItem('aura_stories', JSON.stringify(stories));

    this.emitLocal('STORIES_UPDATED', stories);
    this.broadcast('STORIES_UPDATED', stories);
    return story;
  }

  async getActiveStories() {
    const now = Date.now();
    if (this.db) {
      try {
        const storiesRef = collection(this.db, 'stories');
        const snap = await getDocs(storiesRef);
        if (!snap.empty) {
          const list = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(s => (s.expiresAt || 0) > now);
          localStorage.setItem('aura_stories', JSON.stringify(list));
          return list;
        }
      } catch (_) {}
    }

    const all = this.getLocalStories();
    return all.filter(s => (s.expiresAt || 0) > now);
  }

  async markStoryViewed(storyId, userId) {
    const stories = this.getLocalStories();
    const story = stories.find(s => s.id === storyId);
    if (!story) return;

    if (!Array.isArray(story.viewers)) story.viewers = [];
    if (!story.viewers.includes(userId)) {
      story.viewers.push(userId);
      localStorage.setItem('aura_stories', JSON.stringify(stories));

      if (this.db) {
        try {
          await updateDoc(doc(this.db, 'stories', storyId), { viewers: story.viewers });
        } catch (_) {}
      }

      this.emitLocal('STORIES_UPDATED', stories);
      this.broadcast('STORIES_UPDATED', stories);
    }
  }

  async deleteStory(storyId, userId) {
    if (this.db) {
      try { await deleteDoc(doc(this.db, 'stories', storyId)); } catch (_) {}
    }
    const stories = this.getLocalStories().filter(s => !(s.id === storyId && s.userId === userId));
    localStorage.setItem('aura_stories', JSON.stringify(stories));
    this.emitLocal('STORIES_UPDATED', stories);
    this.broadcast('STORIES_UPDATED', stories);
    return true;
  }

  // ==========================================
  // FOLLOWERS / FOLLOWING
  // ==========================================

  async toggleFollow(currentUserId, targetUserId) {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) return false;

    const users = this.getLocalUsers();
    let me = users.find(u => u.uid === currentUserId) || this.getLocalCurrentUser() || { uid: currentUserId };
    let target = users.find(u => u.uid === targetUserId) || { uid: targetUserId };

    if (!Array.isArray(me.following)) me.following = [];
    if (!Array.isArray(target.followers)) target.followers = [];

    const shouldBeFollowing = !me.following.includes(targetUserId);

    if (shouldBeFollowing) {
      if (!me.following.includes(targetUserId)) me.following.push(targetUserId);
      if (!target.followers.includes(currentUserId)) target.followers.push(currentUserId);

      await this.createNotification({
        recipientId: targetUserId,
        senderId: currentUserId,
        type: 'follow',
        text: 'started following you.',
        timestamp: Date.now()
      });
    } else {
      me.following = me.following.filter(id => id !== targetUserId);
      target.followers = target.followers.filter(id => id !== currentUserId);
    }

    // Persist to local users cache
    const meIdx = users.findIndex(u => u.uid === currentUserId);
    if (meIdx >= 0) users[meIdx] = { ...users[meIdx], ...me }; else users.push(me);

    const targetIdx = users.findIndex(u => u.uid === targetUserId);
    if (targetIdx >= 0) users[targetIdx] = { ...users[targetIdx], ...target }; else users.push(target);

    localStorage.setItem('aura_users', JSON.stringify(users));

    // Update current user cache in localStorage
    const cur = this.getLocalCurrentUser();
    if (cur && cur.uid === currentUserId) {
      this.setLocalCurrentUser({ ...cur, following: me.following });
    }

    // Update Firestore if available
    if (this.db) {
      try {
        await updateDoc(doc(this.db, 'users', currentUserId), { following: me.following });
        await updateDoc(doc(this.db, 'users', targetUserId), { followers: target.followers });
      } catch (_) {}
    }

    this.emitLocal('FOLLOW_UPDATED', { me, target });
    this.broadcast('FOLLOW_UPDATED', { me, target });

    return shouldBeFollowing;
  }

  // ==========================================
  // DIRECT MESSAGING (DMs)
  // ==========================================

  getChatId(uid1, uid2) {
    return [uid1, uid2].sort().join('_chat_');
  }

  async sendMessage(senderId, recipientId, content, mediaUrl = null) {
    const chatId = this.getChatId(senderId, recipientId);
    const message = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      chatId,
      senderId,
      recipientId,
      content,
      mediaUrl,
      timestamp: Date.now(),
      read: false
    };

    // 1. Firestore if available
    if (this.db) {
      try {
        await setDoc(doc(this.db, 'messages', message.id), message);
      } catch (_) {}
    }

    // 2. Local cache
    const messages = this.getLocalMessages();
    messages.push(message);
    localStorage.setItem('aura_messages', JSON.stringify(messages));

    this.emitLocal('MESSAGE_SENT', message);
    this.broadcast('MESSAGE_SENT', message);
    return message;
  }

  async fetchMessages() {
    if (this.db) {
      try {
        const messagesRef = collection(this.db, 'messages');
        const snap = await getDocs(messagesRef);
        if (!snap.empty) {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          localStorage.setItem('aura_messages', JSON.stringify(list));
          this.emitLocal('MESSAGES_UPDATED', list);
          return list;
        }
      } catch (_) {}
    }
    return this.getLocalMessages();
  }

  getMessages(uid1, uid2) {
    const chatId = this.getChatId(uid1, uid2);
    const all = this.getLocalMessages();
    return all.filter(m => m.chatId === chatId).sort((a, b) => a.timestamp - b.timestamp);
  }

  getRecentConversations(currentUserId) {
    const all = this.getLocalMessages();
    const chats = new Map();

    all.forEach(m => {
      if (m.senderId === currentUserId || m.recipientId === currentUserId) {
        const partnerId = m.senderId === currentUserId ? m.recipientId : m.senderId;
        const existing = chats.get(partnerId);
        if (!existing || m.timestamp > existing.timestamp) {
          chats.set(partnerId, m);
        }
      }
    });

    return Array.from(chats.entries()).map(([partnerId, lastMessage]) => ({
      partnerId,
      lastMessage
    })).sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);
  }

  // ==========================================
  // NOTIFICATIONS
  // ==========================================

  async createNotification(notifData) {
    const notif = {
      id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      read: false,
      timestamp: Date.now(),
      ...notifData
    };

    if (this.db) {
      try {
        await setDoc(doc(this.db, 'notifications', notif.id), notif);
      } catch (_) {}
    }

    const list = this.getLocalNotifications();
    list.unshift(notif);
    localStorage.setItem('aura_notifications', JSON.stringify(list));

    this.emitLocal('NOTIFICATION_NEW', notif);
    this.broadcast('NOTIFICATION_NEW', notif);
    return notif;
  }

  getNotifications(userId) {
    return this.getLocalNotifications().filter(n => n.recipientId === userId);
  }

  // ==========================================
  // LOCAL STORAGE HELPERS
  // ==========================================

  getLocalCurrentUser() {
    try {
      const data = localStorage.getItem('aura_current_user');
      return data ? JSON.parse(data) : null;
    } catch (_) {
      return null;
    }
  }

  setLocalCurrentUser(user) {
    if (user) {
      localStorage.setItem('aura_current_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('aura_current_user');
    }
  }

  getLocalUsers() {
    try {
      return JSON.parse(localStorage.getItem('aura_users') || '[]');
    } catch (_) {
      return [];
    }
  }

  getLocalPosts() {
    try {
      return JSON.parse(localStorage.getItem('aura_posts') || '[]');
    } catch (_) {
      return [];
    }
  }

  getLocalReels() {
    try {
      return JSON.parse(localStorage.getItem('aura_reels') || '[]');
    } catch (_) {
      return [];
    }
  }

  getLocalStories() {
    try {
      return JSON.parse(localStorage.getItem('aura_stories') || '[]');
    } catch (_) {
      return [];
    }
  }

  getLocalMessages() {
    try {
      return JSON.parse(localStorage.getItem('aura_messages') || '[]');
    } catch (_) {
      return [];
    }
  }

  getLocalNotifications() {
    try {
      return JSON.parse(localStorage.getItem('aura_notifications') || '[]');
    } catch (_) {
      return [];
    }
  }
}

export const firebaseService = new FirebaseService();
