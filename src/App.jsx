import React, { useState, useEffect } from 'react';
import { Trophy, Star, Zap, User } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Fixed Firebase service class
class FirebaseService {
  constructor() {
    this.db = db;
    this.auth = auth;
    this.initialized = false;
    this.customToken = this.getCustomTokenFromURL();
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
      if (this.customToken) {
        // Authenticate with custom token from Python bot
        await signInWithCustomToken(this.auth, this.customToken);
        console.log('🔥 Firebase authenticated successfully');
      }
      this.initialized = true;
    } catch (error) {
      console.error('Firebase initialization failed:', error);
      throw error;
    }
  }

  async saveUserProgress(userId, userData) {
    await this.init();
    
    try {
      const userRef = doc(this.db, 'users', userId.toString());
      
      const userDoc = {
        userId: userId,
        points: userData.points,
        level: userData.level,
        lastPlayed: serverTimestamp(),
        gamesPlayed: userData.gamesPlayed || 0,
        updatedAt: serverTimestamp(),
        ...(userData.createdAt && { createdAt: serverTimestamp() })
      };
      
      await setDoc(userRef, userDoc, { merge: true });
      
      console.log('🔥 Successfully saved to Firebase:', userDoc);
      return { success: true, method: 'Firebase' };
    } catch (error) {
      console.error('Firebase save failed:', error);
      // Fallback to localStorage if Firebase fails
      return await this.saveToLocalStorage(userId, userData);
    }
  }

  async getUserProgress(userId) {
    await this.init();
    
    try {
      const userRef = doc(this.db, 'users', userId.toString());
      const docSnap = await getDoc(userRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('🔥 Loaded from Firebase:', data);
        
        return {
          userId: data.userId,
          points: data.points || 0,
          level: data.level || 1,
          gamesPlayed: data.gamesPlayed || 0,
          lastPlayed: data.lastPlayed?.toDate?.()?.toISOString() || data.lastPlayed,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
          source: 'Firebase'
        };
      } else {
        // Create new user
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
        
        console.log('👤 Created new Firebase user:', newUser);
        return newUser;
      }
    } catch (error) {
      console.error('Firebase get failed, using localStorage:', error);
      return await this.getFromLocalStorage(userId);
    }
  }

  // Fallback localStorage methods
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
        source: 'localStorage (fallback)'
      };
      
      localStorage.setItem(`user_${userId}`, JSON.stringify(userDoc));
      console.log('💾 Saved to localStorage as fallback:', userDoc);
      
      return { success: true, method: 'localStorage (fallback)' };
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
        return { ...userData, source: 'localStorage (fallback)' };
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

  // Get Telegram user
  const getTelegramUser = () => {
    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
      const user = window.Telegram.WebApp.initDataUnsafe.user;
      console.log('✅ Real Telegram user detected:', user);
      return user;
    }
    
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
    const initApp = async () => {
      try {
        const telegramUser = getTelegramUser();
        setUser(telegramUser);
        
        console.log('🚀 Loading user progress for:', telegramUser.id);
        
        // Load user progress from Firebase
        const progress = await firebaseService.getUserProgress(telegramUser.id);
        setPoints(progress.points || 0);
        setLevel(progress.level || 1);
        setGamesPlayed(progress.gamesPlayed || 0);
        setLastPlayed(progress.lastPlayed || null);
        setStorageMethod(progress.source || 'Unknown');
        
        console.log('📊 Loaded progress:', progress);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setPoints(0);
        setLevel(1);
        setGamesPlayed(0);
        setStorageMethod('Error');
      } finally {
        setIsLoading(false);
      }
    };

    initApp();

    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  }, []);

  const handleTap = async () => {
    const pointsGained = level;
    const newPoints = points + pointsGained;
    const newLevel = Math.floor(newPoints / 100) + 1;
    
    setPoints(newPoints);
    setLevel(newLevel);
    setClickAnimation(true);
    
    setTimeout(() => setClickAnimation(false), 200);
    
    if (user) {
      setIsSaving(true);
      try {
        const userData = {
          points: newPoints,
          level: newLevel,
          gamesPlayed: gamesPlayed + 1,
          createdAt: lastPlayed ? undefined : new Date().toISOString()
        };
        
        console.log('💾 Saving progress:', userData);
        const result = await firebaseService.saveUserProgress(user.id, userData);
        
        setGamesPlayed(prev => prev + 1);
        setLastPlayed(new Date().toISOString());
        setStorageMethod(result.method);
        
        // Send data back to Telegram bot
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
        setStorageMethod('Save Error');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const sendDataToBot = (data) => {
    if (window.Telegram?.WebApp) {
      console.log('📤 Sending data to bot:', data);
      window.Telegram.WebApp.sendData(JSON.stringify(data));
    }
  };

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
          <p className="text-white text-lg">Loading your game...</p>
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
              <span className="text-sm">Saving to Firebase...</span>
            </div>
          </div>
        )}

        {/* Environment Indicator */}
        <div className="fixed top-4 right-4 bg-black/30 backdrop-blur-sm rounded-lg px-3 py-1">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${storageMethod?.includes('Firebase') ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
            <span className="text-xs text-white/80">
              {storageMethod?.includes('Firebase') ? '🔥 Firebase' : '💾 Local'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelegramMiniApp;