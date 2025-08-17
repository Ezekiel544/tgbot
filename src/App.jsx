// Fixed Firebase Service Implementation with Proper Auth Configuration
import React, { useState, useEffect } from 'react';
import { Trophy, Star, Zap, User, Wifi, WifiOff } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, query, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInWithCustomToken, signInAnonymously, connectAuthEmulator } from 'firebase/auth';

// Firebase configuration - MAKE SURE THIS MATCHES YOUR PROJECT
const firebaseConfig = {
  apiKey: "AIzaSyDx77ZNDIT-56mHzwQp6wglRURUZGg-KS0",
  authDomain: "tgbot-4d504.firebaseapp.com",
  projectId: "tgbot-4d504",
  storageBucket: "tgbot-4d504.firebasestorage.app",
  messagingSenderId: "826370102389",
  appId: "1:826370102389:web:4d1755bc152b9d706ed43c"
};

// Fixed Firebase service class
class FirebaseService {
  constructor() {
    this.initialized = false;
    this.app = null;
    this.db = null;
    this.auth = null;
    this.customToken = this.getCustomTokenFromURL();
    this.authInitialized = false;
  }

  getCustomTokenFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      console.log('🔑 Custom Firebase token received from bot');
    }
    return token;
  }

  async init() {
    if (this.initialized) return;
    
    try {
      console.log('🔥 Initializing Firebase...');
      
      // Initialize Firebase App
      this.app = initializeApp(firebaseConfig);
      this.db = getFirestore(this.app);
      this.auth = getAuth(this.app);
      
      // Important: Wait for auth to be ready
      await new Promise((resolve) => {
        const unsubscribe = this.auth.onAuthStateChanged((user) => {
          console.log('🔐 Auth state changed:', user ? 'signed in' : 'signed out');
          unsubscribe();
          resolve();
        });
      });
      
      // Authenticate user
      if (this.customToken) {
        try {
          console.log('🔐 Signing in with custom token...');
          const result = await signInWithCustomToken(this.auth, this.customToken);
          console.log('✅ Authenticated with custom token:', result.user.uid);
        } catch (authError) {
          console.warn('⚠️ Custom token auth failed:', authError);
          console.log('🔐 Falling back to anonymous authentication...');
          const result = await signInAnonymously(this.auth);
          console.log('✅ Anonymous authentication successful:', result.user.uid);
        }
      } else {
        console.log('🔐 No custom token, signing in anonymously...');
        const result = await signInAnonymously(this.auth);
        console.log('✅ Anonymous authentication successful:', result.user.uid);
      }
      
      console.log('✅ Firebase initialized successfully');
      console.log('👤 Current user:', this.auth.currentUser?.uid);
      
      this.initialized = true;
      this.authInitialized = true;
    } catch (error) {
      console.error('❌ Firebase initialization failed:', error);
      // Don't throw error, try to work without auth
      if (!this.db) {
        throw error;
      }
    }
  }

  async ensureAuth() {
    if (!this.authInitialized || !this.auth.currentUser) {
      console.log('🔄 Re-initializing authentication...');
      await this.init();
    }
    
    if (!this.auth.currentUser) {
      console.log('🔐 Force anonymous sign in...');
      await signInAnonymously(this.auth);
    }
  }

  async saveUserProgress(userId, userData, userInfo = {}) {
    try {
      await this.init();
      await this.ensureAuth();
      
      console.log('💾 Saving user progress...', { userId, userData, userInfo });
      
      const userRef = doc(this.db, 'users', userId.toString());
      
      const userDoc = {
        userId: Number(userId),
        points: userData.points || 0,
        level: userData.level || 1,
        gamesPlayed: userData.gamesPlayed || 0,
        lastPlayed: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      // Add user info (name and username) if provided
      if (userInfo.first_name) {
        userDoc.firstName = userInfo.first_name;
      }
      if (userInfo.username) {
        userDoc.username = userInfo.username;
      }
      
      // Add createdAt only for new users
      if (userData.createdAt) {
        userDoc.createdAt = serverTimestamp();
      }
      
      // Use merge: true to update existing document or create new one
      await setDoc(userRef, userDoc, { merge: true });
      
      console.log('✅ User progress saved successfully with user info');
      return { success: true, method: 'Firebase' };
      
    } catch (error) {
      console.error('❌ Firebase save failed:', error);
      throw new Error(`Failed to save to Firebase: ${error.message}`);
    }
  }

  async getUserProgress(userId) {
    try {
      await this.init();
      
      console.log('📥 Loading user progress for:', userId);
      
      const userRef = doc(this.db, 'users', userId.toString());
      const docSnap = await getDoc(userRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('📦 Found existing user data:', data);
        
        return {
          userId: data.userId,
          points: data.points || 0,
          level: data.level || 1,
          gamesPlayed: data.gamesPlayed || 0,
          firstName: data.firstName || null,
          username: data.username || null,
          lastPlayed: data.lastPlayed?.toDate?.()?.toISOString() || new Date().toISOString(),
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          source: 'Firebase'
        };
      } else {
        console.log('👤 User not found, will create on first save');
        
        return {
          userId: Number(userId),
          points: 0,
          level: 1,
          gamesPlayed: 0,
          firstName: null,
          username: null,
          lastPlayed: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          source: 'Firebase (new)',
          isNewUser: true
        };
      }
    } catch (error) {
      console.error('❌ Firebase get failed:', error);
      throw new Error(`Failed to load from Firebase: ${error.message}`);
    }
  }

  async getLeaderboard(limit = 10) {
    try {
      await this.init();
      
      console.log('🏆 Loading leaderboard...');
      
      const usersRef = collection(this.db, 'users');
      const q = query(usersRef, orderBy('points', 'desc'), limit(limit));
      const querySnapshot = await getDocs(q);
      
      const leaderboard = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        leaderboard.push({
          userId: data.userId,
          firstName: data.firstName || 'Anonymous',
          username: data.username || null,
          points: data.points || 0,
          level: data.level || 1,
          gamesPlayed: data.gamesPlayed || 0,
          lastPlayed: data.lastPlayed?.toDate?.()?.toISOString()
        });
      });
      
      console.log('📊 Leaderboard loaded:', leaderboard);
      return leaderboard;
      
    } catch (error) {
      console.error('❌ Error getting leaderboard:', error);
      // Return demo data on error
      return [
        { userId: 123456789, firstName: 'Demo Player', username: 'demo_user', points: 1500, level: 16 },
        { userId: 987654321, firstName: 'Test User', username: 'test_user', points: 1200, level: 13 },
        { userId: 456789123, firstName: 'Sample Player', username: 'sample_user', points: 800, level: 9 }
      ];
    }
  }

  isOnline() {
    return navigator.onLine && this.initialized;
  }
}

// Create singleton instance
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
  const [isOnline, setIsOnline] = useState(true);
  const [saveError, setSaveError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');

  // Get Telegram user with better error handling
  const getTelegramUser = () => {
    try {
      // Check if running in real Telegram
      if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const user = window.Telegram.WebApp.initDataUnsafe.user;
        console.log('✅ Real Telegram user detected:', user);
        return user;
      }
      
      // Check for Telegram WebApp context
      if (window.Telegram?.WebApp) {
        console.log('⚠️ Telegram WebApp detected but no user data');
        const sessionUser = {
          id: Date.now(),
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
    } catch (error) {
      console.error('Error getting Telegram user:', error);
      return {
        id: 123456789,
        first_name: "Error User",
        username: "error_user",
        is_premium: false
      };
    }
  };

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const initApp = async () => {
      try {
        console.log('🚀 Initializing app...');
        setConnectionStatus('Getting user info...');
        
        const telegramUser = getTelegramUser();
        setUser(telegramUser);
        
        console.log('📱 User ID:', telegramUser.id);
        
        setConnectionStatus('Connecting to Firebase...');
        
        // Load user progress from Firebase
        const progress = await firebaseService.getUserProgress(telegramUser.id);
        
        console.log('📊 Loaded progress:', progress);
        
        setPoints(progress.points || 0);
        setLevel(progress.level || 1);
        setGamesPlayed(progress.gamesPlayed || 0);
        setLastPlayed(progress.lastPlayed || null);
        
        setSaveError(null);
        setConnectionStatus('Connected');
        
        // If it's a new user, create the initial document
        if (progress.isNewUser) {
          console.log('👤 Creating initial user document...');
          await firebaseService.saveUserProgress(telegramUser.id, {
            points: 0,
            level: 1,
            gamesPlayed: 0,
            createdAt: true
          }, telegramUser); // Pass the user info here too
        }
        
      } catch (error) {
        console.error('❌ Failed to initialize app:', error);
        setSaveError(`Failed to load progress: ${error.message}`);
        setConnectionStatus('Connection failed');
        
        // Set default values on error
        setPoints(0);
        setLevel(1);
        setGamesPlayed(0);
      } finally {
        setIsLoading(false);
      }
    };

    initApp();

    // Set up Telegram WebApp
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  }, []);

  const handleTap = async () => {
    if (!isOnline) {
      setSaveError('You are offline. Progress cannot be saved.');
      return;
    }

    if (isSaving) {
      console.log('⏳ Save in progress, skipping tap');
      return;
    }

    const pointsGained = level;
    const newPoints = points + pointsGained;
    const newLevel = Math.floor(newPoints / 100) + 1;
    const newGamesPlayed = gamesPlayed + 1;
    
    // Update UI immediately for better UX
    setPoints(newPoints);
    setLevel(newLevel);
    setGamesPlayed(newGamesPlayed);
    setClickAnimation(true);
    setSaveError(null);
    
    // Reset animation
    setTimeout(() => setClickAnimation(false), 200);
    
    // Save progress to Firebase
    if (user) {
      setIsSaving(true);
      try {
        console.log('💾 Saving progress...', {
          userId: user.id,
          points: newPoints,
          level: newLevel,
          gamesPlayed: newGamesPlayed
        });
        
        const userData = {
          points: newPoints,
          level: newLevel,
          gamesPlayed: newGamesPlayed,
          createdAt: !lastPlayed // Only set createdAt for new users
        };
        
        // Pass user info to save method
        await firebaseService.saveUserProgress(user.id, userData, user);
        
        setLastPlayed(new Date().toISOString());
        
        console.log('✅ Progress saved successfully');
        
        // Send data back to Telegram bot on level up or every 10 taps
        if ((newLevel > level) || (newPoints % 10 === 0)) {
          sendDataToBot({
            action: 'progress_update',
            points: newPoints,
            level: newLevel,
            gamesPlayed: newGamesPlayed
          });
        }
        
      } catch (error) {
        console.error('❌ Failed to save progress:', error);
        setSaveError(`Save failed: ${error.message}`);
        
        // Revert UI changes on error
        setPoints(points);
        setLevel(level);
        setGamesPlayed(gamesPlayed);
        
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Send data back to Telegram bot
  const sendDataToBot = (data) => {
    try {
      if (window.Telegram?.WebApp) {
        console.log('📤 Sending data to bot:', data);
        window.Telegram.WebApp.sendData(JSON.stringify(data));
      }
    } catch (error) {
      console.error('Failed to send data to bot:', error);
    }
  };

  // Handle app close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user && points > 0) {
        sendDataToBot({
          action: 'game_completed',
          points: points,
          level: level,
          gamesPlayed: gamesPlayed,
          sessionDuration: Date.now() - new Date(lastPlayed || Date.now()).getTime()
        });
      }
    };

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
  }, [user, points, level, gamesPlayed, lastPlayed]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-white border-t-transparent mb-4 mx-auto"></div>
          <p className="text-white text-lg">{connectionStatus}</p>
          <p className="text-white/70 text-sm mt-2">Loading your game data</p>
          <div className="text-white/50 text-xs mt-4">
            {user && <p>User ID: {user.id}</p>}
            <p>🔥 Firebase: {firebaseService.initialized ? 'Connected' : 'Connecting...'}</p>
          </div>
        </div>
      </div>
    );
  }

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
              <p className="text-white/50 text-xs">ID: {user?.id}</p>
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
            disabled={isSaving || !isOnline}
            className={`relative w-48 h-48 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full shadow-2xl transform transition-all duration-150 hover:scale-105 active:scale-95 ${
              clickAnimation ? 'scale-110' : ''
            } ${isSaving || !isOnline ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'}`}
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
            <p className="text-white/70 text-xs">Taps</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
            <Zap className="w-6 h-6 text-green-400 mx-auto mb-2" />
            <p className="text-xl font-bold">{Math.floor(points / Math.max(gamesPlayed, 1))}</p>
            <p className="text-white/70 text-xs">Avg/Tap</p>
          </div>
        </div>

        {/* Error Messages */}
        {saveError && (
          <div className="fixed bottom-20 left-4 right-4 bg-red-500/90 backdrop-blur-sm rounded-lg p-3 z-50">
            <div className="flex items-center space-x-2">
              <WifiOff className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{saveError}</span>
            </div>
          </div>
        )}

        {/* Save Status */}
        {isSaving && (
          <div className="fixed bottom-4 left-4 right-4 bg-green-500/90 backdrop-blur-sm rounded-lg p-3 z-50">
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              <span className="text-sm">Saving to Firebase...</span>
            </div>
          </div>
        )}

        {/* Firebase Connection Indicator */}
        <div className="fixed top-4 right-4 bg-black/30 backdrop-blur-sm rounded-lg px-3 py-1">
          <div className="flex items-center space-x-2">
            {isOnline && firebaseService.initialized ? (
              <Wifi className="w-3 h-3 text-green-400" />
            ) : (
              <WifiOff className="w-3 h-3 text-red-400" />
            )}
            <div className={`w-2 h-2 rounded-full ${
              isOnline && firebaseService.initialized ? 'bg-green-400' : 'bg-red-400'
            }`}></div>
            <span className="text-xs text-white/80">🔥 {connectionStatus}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelegramMiniApp;