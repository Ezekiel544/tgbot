import React, { useState, useEffect } from 'react';
import { Trophy, Star, Zap, User, Wifi, WifiOff } from 'lucide-react';
import { initializeApp } from 'firebase/app';
      import { getFirestore } from 'firebase/firestore';
      import { getAuth, signInWithCustomToken } from 'firebase/auth';
      

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDx77ZNDIT-56mHzwQp6wglRURUZGg-KS0",
  authDomain: "tgbot-4d504.firebaseapp.com",
  projectId: "tgbot-4d504",
  storageBucket: "tgbot-4d504.firebasestorage.app",
  messagingSenderId: "826370102389",
  appId: "1:826370102389:web:4d1755bc152b9d706ed43c"
};

// Firebase service class - Firebase only implementation
class FirebaseService {
  constructor() {
    this.initialized = false;
    this.customToken = this.getCustomTokenFromURL();
    this.userData = new Map(); // In-memory cache for demo
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
      // In production, initialize Firebase SDK here:
      
      this.app = initializeApp(firebaseConfig);
      this.db = getFirestore(this.app);
      this.auth = getAuth(this.app);
      
      if (this.customToken) {
        await signInWithCustomToken(this.auth, this.customToken);
      }
      
      console.log('🔥 Firebase initialized');
      console.log('🔐 Authentication:', this.customToken ? 'Authenticated via bot' : 'Anonymous mode');
      
      this.initialized = true;
    } catch (error) {
      console.error('Firebase initialization failed:', error);
      throw error;
    }
  }

  async saveUserProgress(userId, userData) {
    await this.init();
    
    try {
      // In production with real Firebase:
      const userRef = doc(this.db, 'users', userId.toString());
      const userDoc = {
        userId: userId,
        points: userData.points,
        level: userData.level,
        lastPlayed: serverTimestamp(),
        gamesPlayed: userData.gamesPlayed,
        updatedAt: serverTimestamp(),
        ...(userData.createdAt && { createdAt: serverTimestamp() })
      };
      await setDoc(userRef, userDoc, { merge: true });
      
      // Demo implementation - simulate Firebase save
      // const userDoc = {
      //   userId: userId,
      //   points: userData.points,
      //   level: userData.level,
      //   lastPlayed: new Date().toISOString(),
      //   gamesPlayed: userData.gamesPlayed || 0,
      //   createdAt: userData.createdAt || new Date().toISOString(),
      //   updatedAt: new Date().toISOString(),
      //   authenticated: !!this.customToken
      // };
      
      // Store in memory (simulating Firebase)
      this.userData.set(userId.toString(), userDoc);
      
      console.log('🔥 Saved to Firebase:', userDoc);
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
      return { success: true, method: 'Firebase' };
    } catch (error) {
      console.error('Firebase save failed:', error);
      throw error;
    }
  }

  async getUserProgress(userId) {
    await this.init();
    
    try {
      // In production with real Firebase:
      const userRef = doc(this.db, 'users', userId.toString());
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        return docSnap.data();
      }
      
      console.log('🔥 Loading from Firebase for user:', userId);
      
      // Demo implementation - check in-memory cache
      // const existingUser = this.userData.get(userId.toString());
      
      if (existingUser) {
        console.log('📦 Found existing user data:', existingUser);
        return { ...existingUser, source: 'Firebase (cached)' };
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
          authenticated: !!this.customToken,
          source: 'Firebase (new)'
        };
        
        // Save new user to Firebase
        this.userData.set(userId.toString(), newUser);
        
        console.log('👤 Created new user in Firebase:', newUser);
        return newUser;
      }
    } catch (error) {
      console.error('Firebase get failed:', error);
      throw error;
    }
  }

  async getLeaderboard(limit = 10) {
    await this.init();
    
    try {
      // In production:
      const usersRef = collection(this.db, 'users');
      const q = query(usersRef, orderBy('points', 'desc'), limit(limit));
      const querySnapshot = await getDocs(q);
      
      // Demo leaderboard with some realistic data
      const leaderboard = Array.from(this.userData.values())
        .sort((a, b) => b.points - a.points)
        .slice(0, limit);
      
      // Add some demo users if leaderboard is empty
      // Add some demo users if leaderboard is empty
      // Add some demo users if leaderboard is empty
      // Add some demo users if leaderboard is empty
      if (leaderboard.length === 0) {
        return [
          { userId: 123456789, username: 'demo_user', points: 1500, level: 16 },
          { userId: 987654321, username: 'pro_player', points: 1200, level: 13 },
          { userId: 456789123, username: 'tap_master', points: 800, level: 9 }
        ];
      }
      
      return leaderboard;
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      throw error;
    }
  }

  async getUserRank(userId) {
    await this.init();
    
    try {
      const allUsers = Array.from(this.userData.values())
        .sort((a, b) => b.points - a.points);
      
      const userIndex = allUsers.findIndex(user => user.userId === userId);
      return userIndex >= 0 ? userIndex + 1 : allUsers.length + 1;
    } catch (error) {
      console.error('Error getting user rank:', error);
      return 1;
    }
  }

  isOnline() {
    // In production, you could check Firebase connection state
    return navigator.onLine && this.initialized;
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
  const [isOnline, setIsOnline] = useState(true);
  const [saveError, setSaveError] = useState(null);

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
        const telegramUser = getTelegramUser();
        setUser(telegramUser);
        
        // Load user progress from Firebase
        const progress = await firebaseService.getUserProgress(telegramUser.id);
        setPoints(progress.points || 0);
        setLevel(progress.level || 1);
        setGamesPlayed(progress.gamesPlayed || 0);
        setLastPlayed(progress.lastPlayed || null);
        
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setSaveError('Failed to load progress from Firebase');
        // Set default values
        setPoints(0);
        setLevel(1);
        setGamesPlayed(0);
      } finally {
        setIsLoading(false);
      }
    };

    initApp();

    // Set up Telegram WebApp theme
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

    const pointsGained = level;
    const newPoints = points + pointsGained;
    const newLevel = Math.floor(newPoints / 100) + 1;
    
    setPoints(newPoints);
    setLevel(newLevel);
    setClickAnimation(true);
    setSaveError(null);
    
    // Reset animation
    setTimeout(() => setClickAnimation(false), 200);
    
    // Save progress to Firebase
    if (user) {
      setIsSaving(true);
      try {
        const userData = {
          points: newPoints,
          level: newLevel,
          gamesPlayed: gamesPlayed + 1,
          createdAt: lastPlayed ? undefined : new Date().toISOString()
        };
        
        await firebaseService.saveUserProgress(user.id, userData);
        setGamesPlayed(prev => prev + 1);
        setLastPlayed(new Date().toISOString());
        
        // Send data back to Telegram bot every 10 taps or level up
        if ((newPoints % 10 === 0) || (newLevel > level)) {
          sendDataToBot({
            action: 'progress_update',
            points: newPoints,
            level: newLevel,
            gamesPlayed: gamesPlayed + 1
          });
        }
        
      } catch (error) {
        console.error('Failed to save progress:', error);
        setSaveError('Failed to save progress to Firebase');
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
          <p className="text-white text-lg">Loading from Firebase...</p>
          <p className="text-white/70 text-sm mt-2">Initializing game data</p>
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
          <div className="fixed bottom-20 left-4 right-4 bg-red-500/90 backdrop-blur-sm rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <WifiOff className="w-4 h-4" />
              <span className="text-sm">{saveError}</span>
            </div>
          </div>
        )}

        {/* Save Status */}
        {isSaving && (
          <div className="fixed bottom-4 left-4 right-4 bg-white/20 backdrop-blur-sm rounded-lg p-3">
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              <span className="text-sm">Saving to Firebase...</span>
            </div>
          </div>
        )}

        {/* Firebase Connection Indicator */}
        <div className="fixed top-4 right-4 bg-black/30 backdrop-blur-sm rounded-lg px-3 py-1">
          <div className="flex items-center space-x-2">
            {isOnline ? (
              <Wifi className="w-3 h-3 text-green-400" />
            ) : (
              <WifiOff className="w-3 h-3 text-red-400" />
            )}
            <div className="w-2 h-2 rounded-full bg-green-400"></div>
            <span className="text-xs text-white/80">🔥 Firebase</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelegramMiniApp;