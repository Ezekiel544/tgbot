import React, { useState, useEffect } from 'react';
import { Trophy, Star, Zap, User } from 'lucide-react';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDx77ZNDIT-56mHzwQp6wglRURUZGg-KS0",
  authDomain: "tgbot-4d504.firebaseapp.com",
  projectId: "tgbot-4d504",
  storageBucket: "tgbot-4d504.firebasestorage.app",
  messagingSenderId: "826370102389",
  appId: "1:826370102389:web:4d1755bc152b9d706ed43c"
};

// Firebase service class
class FirebaseService {
  constructor() {
    this.app = null;
    this.db = null;
    this.auth = null;
    this.initialized = false;
    this.isProduction = this.detectEnvironment();
    this.customToken = this.getCustomTokenFromURL();
  }

  detectEnvironment() {
    const isProduction = window.location.hostname !== 'localhost' && 
                        window.location.hostname !== '127.0.0.1' &&
                        window.location.protocol === 'https:' &&
                        !window.location.hostname.includes('claude.ai');
    
    console.log('Environment detected:', isProduction ? 'PRODUCTION (Firebase)' : 'DEVELOPMENT (localStorage)');
    return isProduction;
  }

  getCustomTokenFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      console.log('🔑 Custom Firebase token received from bot');
    }
    return token;
  }

  async loadFirebaseSDK() {
    if (window.firebase) {
      console.log('🔥 Firebase SDK already loaded');
      return window.firebase;
    }

    try {
      // Load Firebase SDK from CDN
      await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/firebase/9.23.0/firebase-app-compat.min.js');
      await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/firebase/9.23.0/firebase-firestore-compat.min.js');
      await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/firebase/9.23.0/firebase-auth-compat.min.js');
      
      console.log('🔥 Firebase SDK loaded successfully');
      return window.firebase;
    } catch (error) {
      console.error('Failed to load Firebase SDK:', error);
      throw error;
    }
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async init() {
    if (this.initialized) return;
    
    try {
      if (this.isProduction) {
        console.log('🔥 Initializing Firebase for PRODUCTION');
        
        // Load Firebase SDK
        const firebase = await this.loadFirebaseSDK();
        
        // Initialize Firebase app
        if (!firebase.apps.length) {
          this.app = firebase.initializeApp(firebaseConfig);
        } else {
          this.app = firebase.apps[0];
        }
        
        // Initialize Firestore
        this.db = firebase.firestore();
        
        // Initialize Auth
        this.auth = firebase.auth();
        
        // Enable offline persistence
        try {
          await this.db.enablePersistence();
          console.log('📱 Offline persistence enabled');
        } catch (err) {
          if (err.code === 'failed-precondition') {
            console.log('⚠️ Multiple tabs open, persistence can only be enabled in one tab at a time.');
          } else if (err.code === 'unimplemented') {
            console.log('⚠️ The current browser does not support offline persistence');
          }
        }
        
        // Authenticate with custom token if available
        if (this.customToken) {
          try {
            await this.auth.signInWithCustomToken(this.customToken);
            console.log('🔐 User authenticated via custom token');
          } catch (authError) {
            console.error('🔐 Authentication failed:', authError);
            // Continue without authentication - use anonymous auth
            await this.auth.signInAnonymously();
            console.log('👤 Signed in anonymously');
          }
        } else {
          // Sign in anonymously for users without custom token
          await this.auth.signInAnonymously();
          console.log('👤 Signed in anonymously');
        }
        
      } else {
        console.log('💾 Using localStorage for DEVELOPMENT');
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Firebase initialization failed, falling back to localStorage:', error);
      this.isProduction = false;
      this.initialized = true;
    }
  }

  async saveUserProgress(userId, userData) {
    await this.init();
    
    if (this.isProduction) {
      return await this.saveToFirebase(userId, userData);
    } else {
      return await this.saveToLocalStorage(userId, userData);
    }
  }

  async getUserProgress(userId) {
    await this.init();
    
    if (this.isProduction) {
      return await this.getFromFirebase(userId);
    } else {
      return await this.getFromLocalStorage(userId);
    }
  }

  async saveToFirebase(userId, userData) {
    try {
      if (!this.db) {
        throw new Error('Firestore not initialized');
      }

      const userRef = this.db.collection('users').doc(userId.toString());
      
      // Prepare user document
      const userDoc = {
        userId: userId,
        points: userData.points,
        level: userData.level,
        lastPlayed: this.db.FieldValue.serverTimestamp(),
        gamesPlayed: userData.gamesPlayed || 0,
        updatedAt: this.db.FieldValue.serverTimestamp()
      };

      // Add createdAt only for new users
      if (userData.createdAt) {
        userDoc.createdAt = this.db.FieldValue.serverTimestamp();
      }

      // Save to Firestore
      await userRef.set(userDoc, { merge: true });
      
      console.log('🔥 Successfully saved to Firebase:', { userId, points: userData.points, level: userData.level });
      
      return { success: true, method: 'Firebase' };
    } catch (error) {
      console.error('Firebase save failed:', error);
      
      // Fallback to localStorage if Firebase fails
      console.log('📱 Falling back to localStorage...');
      return await this.saveToLocalStorage(userId, userData);
    }
  }

  async getFromFirebase(userId) {
    try {
      if (!this.db) {
        throw new Error('Firestore not initialized');
      }

      const userRef = this.db.collection('users').doc(userId.toString());
      const docSnap = await userRef.get();
      
      if (docSnap.exists) {
        const data = docSnap.data();
        console.log('🔥 Loaded user data from Firebase:', data);
        
        // Convert timestamps to ISO strings for consistency
        const userData = {
          ...data,
          lastPlayed: data.lastPlayed?.toDate?.()?.toISOString() || new Date().toISOString(),
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          source: 'Firebase'
        };
        
        return userData;
      } else {
        // Create new user in Firebase
        const newUser = {
          userId: userId,
          points: 0,
          level: 1,
          gamesPlayed: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastPlayed: new Date().toISOString(),
          source: 'Firebase (new)'
        };
        
        // Save new user to Firebase
        await this.saveToFirebase(userId, { ...newUser, createdAt: true });
        
        console.log('👤 Created new user in Firebase:', newUser);
        return newUser;
      }
    } catch (error) {
      console.error('Firebase get failed:', error);
      
      // Fallback to localStorage
      console.log('📱 Falling back to localStorage...');
      return await this.getFromLocalStorage(userId);
    }
  }

  // localStorage methods (for development and fallback)
  async saveToLocalStorage(userId, userData) {
    try {
      const userDoc = {
        userId: userId,
        points: userData.points,
        level: userData.level,
        lastPlayed: new Date().toISOString(),
        gamesPlayed: userData.gamesPlayed || 0,
        createdAt: userData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: 'localStorage'
      };
      
      localStorage.setItem(`user_${userId}`, JSON.stringify(userDoc));
      console.log('💾 Saved to localStorage:', userDoc);
      
      return { success: true, method: 'localStorage' };
    } catch (error) {
      console.error('localStorage save failed:', error);
      throw error;
    }
  }

  async getFromLocalStorage(userId) {
    try {
      const saved = localStorage.getItem(`user_${userId}`);
      
      if (saved) {
        const userData = JSON.parse(saved);
        console.log('💾 Loaded from localStorage:', userData);
        return { ...userData, source: 'localStorage' };
      } else {
        const newUser = {
          userId: userId,
          points: 0,
          level: 1,
          gamesPlayed: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastPlayed: new Date().toISOString(),
          source: 'localStorage (new)'
        };
        
        console.log('💾 New user created in localStorage:', newUser);
        return newUser;
      }
    } catch (error) {
      console.error('localStorage get failed:', error);
      throw error;
    }
  }

  async getLeaderboard(limit = 10) {
    await this.init();
    
    try {
      if (this.isProduction && this.db) {
        // Get top players from Firebase
        const querySnapshot = await this.db
          .collection('users')
          .orderBy('points', 'desc')
          .limit(limit)
          .get();
        
        const leaderboard = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          leaderboard.push({
            userId: data.userId,
            points: data.points,
            level: data.level,
            lastPlayed: data.lastPlayed?.toDate?.()?.toISOString() || null
          });
        });
        
        console.log('🏆 Leaderboard loaded from Firebase:', leaderboard);
        return leaderboard;
      } else {
        // Mock leaderboard for development
        const mockLeaderboard = [
          { userId: 123456789, username: 'demo_user', points: 1500, level: 16 },
          { userId: 987654321, username: 'player2', points: 1200, level: 13 },
          { userId: 456789123, username: 'player3', points: 800, level: 9 }
        ];
        
        console.log('🏆 Mock leaderboard loaded:', mockLeaderboard);
        return mockLeaderboard;
      }
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return [];
    }
  }

  // Batch operations for better performance
  async batchSaveProgress(updates) {
    if (!this.isProduction || !this.db) {
      // Fallback to individual saves
      const results = [];
      for (const update of updates) {
        results.push(await this.saveUserProgress(update.userId, update.userData));
      }
      return results;
    }

    try {
      const batch = this.db.batch();
      
      updates.forEach(({ userId, userData }) => {
        const userRef = this.db.collection('users').doc(userId.toString());
        const userDoc = {
          userId: userId,
          points: userData.points,
          level: userData.level,
          lastPlayed: this.db.FieldValue.serverTimestamp(),
          gamesPlayed: userData.gamesPlayed || 0,
          updatedAt: this.db.FieldValue.serverTimestamp()
        };

        if (userData.createdAt) {
          userDoc.createdAt = this.db.FieldValue.serverTimestamp();
        }

        batch.set(userRef, userDoc, { merge: true });
      });

      await batch.commit();
      console.log('🔥 Batch save completed:', updates.length, 'updates');
      
      return { success: true, method: 'Firebase Batch', count: updates.length };
    } catch (error) {
      console.error('Batch save failed:', error);
      throw error;
    }
  }
}

const firebaseService = new FirebaseService();

const TelegramMiniApp = () => {
  const [points, setPoints] = useState(0);
  const [level, setLevel] = useState(1);
  const [clickAnimation, setClickAnimation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [lastPlayed, setLastPlayed] = useState(null);
  const [storageMethod, setStorageMethod] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  // Real Telegram WebApp API with better user detection
  const getTelegramUser = () => {
    // Check if running in real Telegram
    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
      const user = window.Telegram.WebApp.initDataUnsafe.user;
      console.log('✅ Real Telegram user detected:', user);
      return user;
    }
    
    // Check for Telegram WebApp context (even without user data)
    if (window.Telegram?.WebApp) {
      console.log('⚠️ Telegram WebApp detected but no user data');
      // Create a session-based user for testing
      const sessionUser = {
        id: Date.now(), // Temporary ID
        first_name: "Test User",
        username: "test_user",
        is_premium: false
      };
      return sessionUser;
    }
    
    // Fallback for development/testing
    console.warn('❌ Not running in Telegram WebApp - using demo user');
    const demoUser = {
      id: 123456789,
      first_name: "Demo",
      username: "demo_user",
      is_premium: false
    };
    return demoUser;
  };

  useEffect(() => {
    // Initialize Telegram WebApp
    const initApp = async () => {
      try {
        setConnectionStatus('connecting');
        
        const telegramUser = getTelegramUser();
        setUser(telegramUser);
        
        // Initialize Firebase service
        await firebaseService.init();
        setConnectionStatus('connected');
        
        // Load user progress
        const progress = await firebaseService.getUserProgress(telegramUser.id);
        setPoints(progress.points || 0);
        setLevel(progress.level || 1);
        setGamesPlayed(progress.gamesPlayed || 0);
        setLastPlayed(progress.lastPlayed || null);
        setStorageMethod(progress.source || 'Unknown');
        
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setConnectionStatus('error');
        
        // Fallback to default values
        setPoints(0);
        setLevel(1);
        setGamesPlayed(0);
        setStorageMethod('Error - Using defaults');
      } finally {
        setIsLoading(false);
      }
    };

    initApp();

    // Set up Telegram WebApp theme
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      
      // Set theme colors
      window.Telegram.WebApp.setHeaderColor('#1a1b3a');
      window.Telegram.WebApp.setBackgroundColor('#0f0f23');
    }
  }, []);

  const handleTap = async () => {
    const pointsGained = level;
    const newPoints = points + pointsGained;
    const newLevel = Math.floor(newPoints / 100) + 1;
    
    setPoints(newPoints);
    setLevel(newLevel);
    setClickAnimation(true);
    
    // Reset animation
    setTimeout(() => setClickAnimation(false), 200);
    
    // Save progress to Firebase/localStorage
    if (user) {
      setIsSaving(true);
      try {
        const userData = {
          points: newPoints,
          level: newLevel,
          gamesPlayed: gamesPlayed,
          createdAt: lastPlayed ? undefined : new Date().toISOString() // Only set on first play
        };
        
        const result = await firebaseService.saveUserProgress(user.id, userData);
        setStorageMethod(result.method);
        setGamesPlayed(prev => prev + 1);
        setLastPlayed(new Date().toISOString());
        
        // Send data back to Telegram bot every 10 taps or level up
        if ((newPoints % 10 === 0) || (newLevel > level)) {
          sendDataToBot({
            action: 'progress_update',
            points: newPoints,
            level: newLevel,
            gamesPlayed: gamesPlayed + 1,
            storageMethod: result.method
          });
        }
        
      } catch (error) {
        console.error('Failed to save progress:', error);
        setStorageMethod('Save Error');
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Send data back to Telegram bot
  const sendDataToBot = (data) => {
    if (window.Telegram?.WebApp) {
      console.log('📤 Sending data to bot:', data);
      window.Telegram.WebApp.sendData(JSON.stringify(data));
    }
  };

  // Handle when user closes the Mini Web App
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user && points > 0) {
        sendDataToBot({
          action: 'game_completed',
          points: points,
          level: level,
          gamesPlayed: gamesPlayed,
          storageMethod: storageMethod,
          sessionDuration: Date.now() - new Date(lastPlayed || Date.now()).getTime()
        });
      }
    };

    // Set up Telegram WebApp close event
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.onEvent('mainButtonClicked', handleBeforeUnload);
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.offEvent('mainButtonClicked', handleBeforeUnload);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      }
    };
  }, [user, points, level, gamesPlayed, lastPlayed, storageMethod]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-white border-t-transparent mb-4 mx-auto"></div>
          <p className="text-white text-lg">Loading your game...</p>
          <p className="text-white/60 text-sm mt-2">
            {connectionStatus === 'connecting' ? 'Connecting to Firebase...' : 
             connectionStatus === 'connected' ? 'Loading your progress...' :
             'Connection failed, using local storage...'}
          </p>
        </div>
      </div>
    );
  }

  const getStorageStatusColor = () => {
    if (storageMethod?.includes('Firebase')) return 'bg-green-400';
    if (storageMethod?.includes('localStorage')) return 'bg-yellow-400';
    return 'bg-red-400';
  };

  const getStorageStatusText = () => {
    if (storageMethod?.includes('Firebase')) return '🔥 Firebase';
    if (storageMethod?.includes('localStorage')) return '💾 Local';
    return '❌ Error';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-800 text-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-bl from-yellow-400/10 to-transparent rounded-full"></div>
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-pink-500/10 to-transparent rounded-full"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg">{user?.first_name || 'Player'}</h2>
              <p className="text-white/70 text-sm">@{user?.username || 'player'}</p>
            </div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2">
            <span className="text-sm">Level {level}</span>
          </div>
        </div>

        {/* Points Display */}
        <div className="text-center mb-8">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mx-auto max-w-sm">
            <div className="flex items-center justify-center mb-2">
              <Trophy className="w-8 h-8 text-yellow-400 mr-2" />
              <h1 className="text-3xl font-bold">{points.toLocaleString()}</h1>
            </div>
            <p className="text-white/70">Total Points</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="bg-white/20 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-yellow-400 to-orange-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${(points % 100)}%` }}
            ></div>
          </div>
          <p className="text-center text-sm text-white/70 mt-2">
            {100 - (points % 100)} points to level {level + 1}
          </p>
        </div>

        {/* Main Game Button */}
        <div className="flex justify-center mb-8">
          <button
            onClick={handleTap}
            disabled={isSaving}
            className={`relative w-48 h-48 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full shadow-2xl transform transition-all duration-150 hover:scale-105 active:scale-95 ${
              clickAnimation ? 'scale-110' : ''
            } ${isSaving ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="absolute inset-4 bg-white/20 rounded-full flex items-center justify-center">
              <div className="text-center">
                <Zap className="w-12 h-12 text-white mx-auto mb-2" />
                <p className="text-white font-bold text-lg">TAP!</p>
                <p className="text-white/80 text-sm">+{level} pts</p>
              </div>
            </div>
            
            {/* Click animation */}
            {clickAnimation && (
              <div className="absolute inset-0 bg-white/30 rounded-full animate-ping"></div>
            )}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
            <Star className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
            <p className="text-xl font-bold">{level}</p>
            <p className="text-white/70 text-xs">Level</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
            <Trophy className="w-6 h-6 text-blue-400 mx-auto mb-2" />
            <p className="text-xl font-bold">{gamesPlayed}</p>
            <p className="text-white/70 text-xs">Games</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
            <Zap className="w-6 h-6 text-green-400 mx-auto mb-2" />
            <p className="text-xl font-bold">{Math.floor(points / Math.max(gamesPlayed, 1))}</p>
            <p className="text-white/70 text-xs">Avg/Game</p>
          </div>
        </div>

        {/* Save Status */}
        {isSaving && (
          <div className="fixed bottom-4 left-4 right-4 bg-white/20 backdrop-blur-sm rounded-lg p-3">
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              <span className="text-sm">Saving to {getStorageStatusText()}...</span>
            </div>
          </div>
        )}

        {/* Environment Indicator */}
        <div className="fixed top-4 right-4 bg-black/30 backdrop-blur-sm rounded-lg px-3 py-1">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${getStorageStatusColor()}`}></div>
            <span className="text-xs text-white/80">
              {getStorageStatusText()}
            </span>
          </div>
        </div>

        {/* Connection Status */}
        {connectionStatus === 'error' && (
          <div className="fixed bottom-20 left-4 right-4 bg-red-500/20 backdrop-blur-sm rounded-lg p-3 border border-red-500/30">
            <p className="text-center text-sm text-red-200">
              ⚠️ Using offline mode - progress will sync when connection is restored
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TelegramMiniApp;