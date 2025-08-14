// firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

// Your Firebase configuration
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

// Firebase service class
class FirebaseService {
  constructor() {
    this.db = db;
  }

  /**
   * Save user progress to Firestore
   * @param {string|number} userId - Telegram user ID
   * @param {Object} userData - User data object
   */
  async saveUserProgress(userId, userData) {
    try {
      const userRef = doc(this.db, 'users', userId.toString());
      
      const userDoc = {
        userId: userId,
        points: userData.points,
        level: userData.level,
        lastPlayed: new Date(),
        gamesPlayed: userData.gamesPlayed || 0,
        updatedAt: new Date(),
        // Only set createdAt if provided (for new users)
        ...(userData.createdAt && { createdAt: new Date(userData.createdAt) })
      };
      
      // Use merge: true to update existing fields or create new document
      await setDoc(userRef, userDoc, { merge: true });
      
      console.log('User progress saved successfully');
      return { success: true };
    } catch (error) {
      console.error('Error saving user progress:', error);
      throw error;
    }
  }

  /**
   * Get user progress from Firestore
   * @param {string|number} userId - Telegram user ID
   */
  async getUserProgress(userId) {
    try {
      const userRef = doc(this.db, 'users', userId.toString());
      const docSnap = await getDoc(userRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Convert Firestore timestamps to ISO strings
        return {
          userId: data.userId,
          points: data.points || 0,
          level: data.level || 1,
          gamesPlayed: data.gamesPlayed || 0,
          lastPlayed: data.lastPlayed?.toISOString?.() || data.lastPlayed,
          createdAt: data.createdAt?.toISOString?.() || data.createdAt,
          updatedAt: data.updatedAt?.toISOString?.() || data.updatedAt
        };
      } else {
        // Create new user document
        const newUser = {
          userId: userId,
          points: 0,
          level: 1,
          gamesPlayed: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastPlayed: new Date().toISOString()
        };
        
        console.log('New user created');
        return newUser;
      }
    } catch (error) {
      console.error('Error getting user progress:', error);
      throw error;
    }
  }

  /**
   * Get leaderboard (top players by points)
   * @param {number} limitCount - Number of top players to return
   */
  async getLeaderboard(limitCount = 10) {
    try {
      const usersRef = collection(this.db, 'users');
      const q = query(usersRef, orderBy('points', 'desc'), limit(limitCount));
      
      const querySnapshot = await getDocs(q);
      const leaderboard = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        leaderboard.push({
          userId: data.userId,
          points: data.points,
          level: data.level,
          gamesPlayed: data.gamesPlayed,
          lastPlayed: data.lastPlayed?.toISOString?.() || data.lastPlayed
        });
      });
      
      return leaderboard;
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      throw error;
    }
  }

  /**
   * Get user rank among all players
   * @param {string|number} userId - Telegram user ID
   */
  async getUserRank(userId) {
    try {
      const userProgress = await this.getUserProgress(userId);
      const userPoints = userProgress.points;
      
      // Query users with higher points
      const usersRef = collection(this.db, 'users');
      const q = query(usersRef, orderBy('points', 'desc'));
      
      const querySnapshot = await getDocs(q);
      let rank = 1;
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.points > userPoints) {
          rank++;
        }
      });
      
      return rank;
    } catch (error) {
      console.error('Error getting user rank:', error);
      throw error;
    }
  }

  /**
   * Get total number of players
   */
  async getTotalPlayers() {
    try {
      const usersRef = collection(this.db, 'users');
      const querySnapshot = await getDocs(usersRef);
      return querySnapshot.size;
    } catch (error) {
      console.error('Error getting total players:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const firebaseService = new FirebaseService();
export default firebaseService;