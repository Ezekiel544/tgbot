// firebase.js - Improved version with proper authentication and error handling
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  serverTimestamp,
  connectFirestoreEmulator 
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDx77ZNDIT-56mHzwQp6wglRURUZGg-KS0",
  authDomain: "tgbot-4d504.firebaseapp.com",
  projectId: "tgbot-4d504",
  storageBucket: "tgbot-4d504.firebasestorage.app",
  messagingSenderId: "826370102389",
  appId: "1:826370102389:web:4d1755bc152b9d706ed43c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Optional: Connect to Firestore emulator for local development
// if (location.hostname === 'localhost') {
//   connectFirestoreEmulator(db, 'localhost', 8080);
// }

class FirebaseService {
  constructor() {
    this.app = app;
    this.db = db;
    this.auth = auth;
    this.initialized = false;
    this.initPromise = null;
  }

  /**
   * Initialize Firebase authentication
   * @param {string} customToken - Optional custom token from Telegram bot
   */
  async initialize(customToken = null) {
    if (this.initialized) return;
    
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise(async (resolve, reject) => {
      try {
        console.log('🔥 Initializing Firebase service...');

        // Wait for auth state to be determined
        const authPromise = new Promise((authResolve) => {
          const unsubscribe = onAuthStateChanged(this.auth, (user) => {
            unsubscribe();
            authResolve(user);
          });
        });

        // Try to authenticate
        if (customToken) {
          try {
            console.log('🔐 Attempting custom token authentication...');
            await signInWithCustomToken(this.auth, customToken);
            console.log('✅ Custom token authentication successful');
          } catch (tokenError) {
            console.warn('⚠️ Custom token failed, falling back to anonymous:', tokenError.message);
            await signInAnonymously(this.auth);
          }
        } else {
          console.log('🔐 Signing in anonymously...');
          await signInAnonymously(this.auth);
        }

        // Wait for auth state
        await authPromise;

        if (!this.auth.currentUser) {
          throw new Error('Authentication failed - no current user');
        }

        console.log('✅ Firebase initialized successfully');
        console.log('👤 Current user:', this.auth.currentUser.uid);
        console.log('🔒 Auth method:', customToken ? 'Custom Token' : 'Anonymous');

        this.initialized = true;
        resolve();
      } catch (error) {
        console.error('❌ Firebase initialization failed:', error);
        reject(error);
      }
    });

    return this.initPromise;
  }

  /**
   * Ensure Firebase is initialized before operations
   */
  async ensureInitialized(customToken = null) {
    if (!this.initialized) {
      await this.initialize(customToken);
    }
  }

  /**
   * Save user progress to Firestore
   * @param {string|number} userId - Telegram user ID
   * @param {Object} userData - User data object
   * @param {string} customToken - Optional custom token
   */
  async saveUserProgress(userId, userData, customToken = null) {
    try {
      await this.ensureInitialized(customToken);

      if (!this.auth.currentUser) {
        throw new Error('User not authenticated');
      }

      console.log('💾 Saving user progress:', { userId, userData });

      const userRef = doc(this.db, 'users', userId.toString());
      
      // Prepare user document
      const userDoc = {
        userId: Number(userId),
        points: Number(userData.points) || 0,
        level: Number(userData.level) || 1,
        gamesPlayed: Number(userData.gamesPlayed) || 0,
        lastPlayed: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Add createdAt only for new users
      if (userData.createdAt || userData.isNewUser) {
        userDoc.createdAt = serverTimestamp();
      }

      // Use merge: true to update existing fields or create new document
      await setDoc(userRef, userDoc, { merge: true });
      
      console.log('✅ User progress saved successfully');
      return { success: true, method: 'Firebase' };

    } catch (error) {
      console.error('❌ Error saving user progress:', error);
      throw new Error(`Failed to save progress: ${error.message}`);
    }
  }

  /**
   * Get user progress from Firestore
   * @param {string|number} userId - Telegram user ID
   * @param {string} customToken - Optional custom token
   */
  async getUserProgress(userId, customToken = null) {
    try {
      await this.ensureInitialized(customToken);

      console.log('📥 Loading user progress for:', userId);

      const userRef = doc(this.db, 'users', userId.toString());
      const docSnap = await getDoc(userRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('📦 Found existing user data');
        
        return {
          userId: data.userId,
          points: data.points || 0,
          level: data.level || 1,
          gamesPlayed: data.gamesPlayed || 0,
          lastPlayed: data.lastPlayed?.toDate?.()?.toISOString() || new Date().toISOString(),
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          source: 'Firebase'
        };
      } else {
        console.log('👤 No existing user found, will create new user on first save');
        
        // Return default user data (don't create document yet)
        return {
          userId: Number(userId),
          points: 0,
          level: 1,
          gamesPlayed: 0,
          lastPlayed: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          source: 'Firebase (new)',
          isNewUser: true
        };
      }
    } catch (error) {
      console.error('❌ Error getting user progress:', error);
      throw new Error(`Failed to load progress: ${error.message}`);
    }
  }

  /**
   * Get leaderboard (top players by points)
   * @param {number} limitCount - Number of top players to return
   */
  async getLeaderboard(limitCount = 10) {
    try {
      await this.ensureInitialized();

      console.log('🏆 Loading leaderboard...');

      const usersRef = collection(this.db, 'users');
      const q = query(usersRef, orderBy('points', 'desc'), limit(limitCount));
      
      const querySnapshot = await getDocs(q);
      const leaderboard = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        leaderboard.push({
          userId: data.userId,
          points: data.points || 0,
          level: data.level || 1,
          gamesPlayed: data.gamesPlayed || 0,
          lastPlayed: data.lastPlayed?.toDate?.()?.toISOString() || null
        });
      });
      
      console.log(`📊 Leaderboard loaded: ${leaderboard.length} players`);
      return leaderboard;

    } catch (error) {
      console.error('❌ Error getting leaderboard:', error);
      // Return empty array on error instead of throwing
      return [];
    }
  }

  /**
   * Get user rank among all players
   * @param {string|number} userId - Telegram user ID
   */
  async getUserRank(userId) {
    try {
      await this.ensureInitialized();

      const userProgress = await this.getUserProgress(userId);
      const userPoints = userProgress.points;
      
      // Query users with higher points
      const usersRef = collection(this.db, 'users');
      const q = query(usersRef, orderBy('points', 'desc'));
      
      const querySnapshot = await getDocs(q);
      let rank = 1;
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.userId === Number(userId)) {
          return rank;
        }
        if (data.points > userPoints) {
          rank++;
        }
      });
      
      return rank;

    } catch (error) {
      console.error('❌ Error getting user rank:', error);
      return 1; // Default rank
    }
  }

  /**
   * Get total number of players
   */
  async getTotalPlayers() {
    try {
      await this.ensureInitialized();

      const usersRef = collection(this.db, 'users');
      const querySnapshot = await getDocs(usersRef);
      
      return querySnapshot.size;

    } catch (error) {
      console.error('❌ Error getting total players:', error);
      return 0;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return this.auth.currentUser !== null;
  }

  /**
   * Get current user ID
   */
  getCurrentUserId() {
    return this.auth.currentUser?.uid || null;
  }

  /**
   * Sign out current user
   */
  async signOut() {
    try {
      await this.auth.signOut();
      this.initialized = false;
      this.initPromise = null;
      console.log('👋 User signed out');
    } catch (error) {
      console.error('❌ Error signing out:', error);
    }
  }

  /**
   * Get connection status
   */
  isOnline() {
    return navigator.onLine && this.initialized;
  }
}

// Export singleton instance
export const firebaseService = new FirebaseService();
export default firebaseService;