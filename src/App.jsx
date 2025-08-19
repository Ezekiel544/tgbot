// Enhanced Firebase Service Implementation with Fixed Leaderboard
import React, { useState, useEffect } from 'react';
import { Trophy, Star, Zap, User, Wifi, WifiOff, Home, DollarSign, HelpCircle } from 'lucide-react';
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
        energy: userData.energy || 1000,
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
          energy: data.energy || 1000,
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
          energy: 1000,
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

  // Fixed getLeaderboard method
  async getLeaderboard(limit = 10) {
    try {
      await this.init();
      await this.ensureAuth(); // Make sure we're authenticated
      
      console.log('🏆 Loading leaderboard...');
      console.log('🔐 Current auth state:', this.auth?.currentUser?.uid);
      console.log('🔥 Firebase initialized:', this.initialized);
      
      if (!this.db) {
        throw new Error('Firestore database not initialized');
      }
      
      const usersRef = collection(this.db, 'users');
      const q = query(usersRef, orderBy('points', 'desc'), limit(limit));
      const querySnapshot = await getDocs(q);
      
      console.log('📊 Query snapshot size:', querySnapshot.size);
      
      if (querySnapshot.empty) {
        console.log('⚠️ No users found in database');
        return [];
      }
      
      const leaderboard = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('👤 User data:', data);
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
      console.error('❌ Error details:', error.code, error.message);
      
      // Don't return demo data - let the UI handle empty state
      throw error;
    }
  }

  // Debug function to check database content
  async debugDatabase() {
    try {
      await this.init();
      await this.ensureAuth();
      
      console.log('🔍 === DATABASE DEBUG START ===');
      console.log('🔍 Auth user:', this.auth?.currentUser?.uid);
      console.log('🔍 DB initialized:', this.initialized);
      
      // Get all users without any filters
      const usersRef = collection(this.db, 'users');
      const allUsersSnapshot = await getDocs(usersRef);
      
      console.log('🔍 Total users in database:', allUsersSnapshot.size);
      
      if (allUsersSnapshot.empty) {
        console.log('🔍 ❌ NO USERS FOUND IN DATABASE!');
        console.log('🔍 This means either:');
        console.log('🔍 1. No users have been saved yet');
        console.log('🔍 2. Users are being saved to a different collection');
        console.log('🔍 3. There\'s an authentication issue');
      } else {
        console.log('🔍 ✅ Users found! Details:');
        allUsersSnapshot.forEach((doc, index) => {
          const data = doc.data();
          console.log(`🔍 User ${index + 1}:`, {
            docId: doc.id,
            userId: data.userId,
            firstName: data.firstName,
            points: data.points,
            level: data.level
          });
        });
      }
      
      console.log('🔍 === DATABASE DEBUG END ===');
    } catch (error) {
      console.error('🔍 DEBUG ERROR:', error);
    }
  }

  isOnline() {
    return navigator.onLine && this.initialized;
  }
}

// Create singleton instance
const firebaseService = new FirebaseService();

// Helper function to get rank info based on points
const getRankInfo = (points) => {
  if (points >= 150000) {
    return { name: 'Legendary', color: 'bg-purple-600', multiplier: 6 };
  } else if (points >= 100000) {
    return { name: 'Ultra Elite', color: 'bg-red-600', multiplier: 5 };
  } else if (points >= 50000) {
    return { name: 'Royal Champion', color: 'bg-blue-600', multiplier: 4 };
  } else if (points >= 20000) {
    return { name: 'Pro', color: 'bg-green-600', multiplier: 3 };
  } else if (points >= 10000) {
    return { name: 'Classic', color: 'bg-yellow-600', multiplier: 2 };
  } else {
    return { name: 'Beginner', color: 'bg-orange-500', multiplier: 1 };
  }
};

// Helper function to format countdown timer for energy refresh
const formatCountdownTimer = (energy, maxEnergy) => {
  if (energy >= maxEnergy) return 'Full Energy!';
  
  const missingEnergy = maxEnergy - energy;
  const totalMinutesForRefresh = 120; // 2 hours = 120 minutes
  const minutesRemaining = Math.ceil((missingEnergy / maxEnergy) * totalMinutesForRefresh);
  
  const hours = Math.floor(minutesRemaining / 60);
  const minutes = minutesRemaining % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m to full energy`;
  } else {
    return `${minutes}m to full energy`;
  }
};

// Home Page Component
const HomePage = ({ 
  points, 
  level, 
  gamesPlayed, 
  handleTap, 
  clickAnimation, 
  isOnline, 
  user,
  userPosition,
  leaderboard,
  energy,
  setEnergy
}) => {
  const maxEnergy = 1000;
  const tapsLeft = energy;
  
  const rankInfo = getRankInfo(points);

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
            <span className="text-black font-bold text-lg">△</span>
          </div>
          <span className="text-white font-medium">{user?.first_name || 'Max_io'}</span>
        </div>
        <div className="text-white/60 text-sm">
          @{user?.username || 'testuser'}
        </div>
      </div>

      {/* Points Display */}
      <div className="text-center py-8">
        <div className="flex items-center justify-center mb-4">
          <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center mr-3">
            <span className="text-black font-bold text-xl">$</span>
          </div>
          <h1 className="text-5xl font-bold text-white">
            {points}
          </h1>
        </div>
        
        {/* Rank Info */}
        <div className="flex items-center justify-center space-x-6 mt-4">
          <div className="flex items-center text-white/60">
            <Trophy className="w-4 h-4 mr-1" />
            <span className="text-sm">#{userPosition || 'Loading...'}</span>
          </div>
          <div className="flex items-center text-white/60">
            <Star className="w-4 h-4 mr-1" />
            <span className="text-sm">{rankInfo.name}</span>
          </div>
        </div>
      </div>

      {/* Main Tap Button */}
      <div className="flex-1 flex items-center justify-center px-8">
        <div 
          className={`relative w-48 h-48 cursor-pointer transition-all duration-150 ${
            clickAnimation ? 'scale-105' : 'scale-100'
          } ${!isOnline || energy <= 0 ? 'opacity-75 cursor-not-allowed' : ''}`}
          onClick={isOnline && energy > 0 ? handleTap : undefined}
        >
          {/* Outer white border */}
          <div className="absolute inset-0 rounded-full border-3 border-white/30"></div>
          
          {/* Main black circle */}
          <div className="absolute inset-3 bg-black rounded-full flex items-center justify-center">
            {/* Inner circle with triangle */}
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center">
              <div className="w-0 h-0 border-l-4 border-r-4 border-b-6 border-l-transparent border-r-transparent border-b-white"></div>
            </div>
          </div>

          {/* Click animation */}
          {clickAnimation && (
            <div className="absolute inset-0 bg-white/20 rounded-full animate-ping"></div>
          )}
        </div>
      </div>

      {/* Energy Display */}
      <div className="px-6 pb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <span className="text-white font-bold text-lg">{energy}</span>
            <span className="text-white/60">/ {maxEnergy}</span>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="bg-gray-800 rounded-full h-3 mb-4">
          <div 
            className="bg-yellow-400 h-full rounded-full transition-all duration-300"
            style={{ width: `${(energy / maxEnergy) * 100}%` }}
          ></div>
        </div>
        
        {/* Energy Info */}
        <div className="text-center">
          <p className="text-white/60 text-sm">{tapsLeft} taps left</p>
          <p className="text-white/60 text-sm">{formatCountdownTimer(energy, maxEnergy)}</p>
        </div>
      </div>
    </div>
  );
};

// Fixed Leaderboard Page Component
const LeaderboardPage = ({ leaderboard, userPosition, user, isLoading }) => {
  if (isLoading) {
    return (
      <div className="flex-1 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mb-4 mx-auto"></div>
          <h2 className="text-2xl font-bold text-white mb-2">Loading Leaderboard...</h2>
        </div>
      </div>
    );
  }

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="flex-1 p-6">
        <div className="text-center">
          <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Leaderboard</h2>
          <p className="text-white/60 mb-4">No players found yet.</p>
          <p className="text-white/40 text-sm">Start playing to appear on the leaderboard!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6">
      <div className="text-center mb-6">
        <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Leaderboard</h2>
        <p className="text-white/60">Your rank: #{userPosition || 'N/A'}</p>
      </div>
      
      <div className="space-y-3">
        {leaderboard.slice(0, 10).map((player, index) => {
          const isCurrentUser = player.userId === user?.id;
          const rankInfo = getRankInfo(player.points);
          
          return (
            <div
              key={player.userId}
              className={`flex items-center justify-between p-4 rounded-lg ${
                isCurrentUser ? 'bg-yellow-500/20 border border-yellow-400' : 'bg-gray-800'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                  index === 0 ? 'bg-yellow-400 text-black' :
                  index === 1 ? 'bg-gray-300 text-black' :
                  index === 2 ? 'bg-orange-400 text-black' :
                  'bg-gray-600 text-white'
                }`}>
                  {index + 1}
                </div>
                
                <div>
                  <div className="flex items-center space-x-2">
                    <p className="text-white font-semibold">
                      {player.firstName || 'Anonymous'}
                    </p>
                    {isCurrentUser && (
                      <span className="text-yellow-400 text-sm">(You)</span>
                    )}
                  </div>
                  <p className="text-white/60 text-sm">
                    @{player.username || 'N/A'} • Level {player.level}
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-white font-bold">{player.points}</p>
                <p className={`text-xs px-2 py-1 rounded ${rankInfo.color} text-white`}>
                  {rankInfo.name}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Earn Page Component
const EarnPage = () => (
  <div className="flex-1 p-6">
    <div className="text-center">
      <DollarSign className="w-16 h-16 text-green-400 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-white mb-2">Earn</h2>
      <p className="text-white/60">Complete tasks to earn more coins!</p>
    </div>
  </div>
);

// Booster Page Component
const BoosterPage = () => (
  <div className="flex-1 p-6">
    <div className="text-center">
      <Zap className="w-16 h-16 text-purple-400 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-white mb-2">Boosters</h2>
      <p className="text-white/60">Boost your earning power!</p>
    </div>
  </div>
);

// Bottom Navigation Component
const BottomNavigation = ({ currentPage, setCurrentPage }) => {
  const navItems = [
    { id: 'default', label: 'HOME', icon: Home },
    { id: 'leaderboard', label: 'LEADERBOARD', icon: Trophy },
    { id: 'earn', label: 'EARN', icon: DollarSign },
    { id: 'booster', label: 'BOOSTER', icon: Zap },
  ];

  return (
    <div className="bg-gray-900 border-t border-gray-700">
      <div className="flex justify-around py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`flex flex-col items-center space-y-1 px-3 py-2 transition-colors ${
                isActive ? 'text-yellow-400' : 'text-white/60 hover:text-white'
              }`}
            >
              <Icon className="w-6 h-6" />
              {item.label && (
                <span className="text-xs font-medium">{item.label}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

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
  const [currentPage, setCurrentPage] = useState('default');
  const [leaderboard, setLeaderboard] = useState([]);
  const [userPosition, setUserPosition] = useState(null);
  const [energy, setEnergy] = useState(1000);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

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
          username: "testuser",
          is_premium: false
        };
        return sessionUser;
      }
      
      // Fallback for development/testing
      console.warn('❌ Not running in Telegram WebApp - using demo user');
      const demoUser = {
        id: 123456789,
        first_name: "Demo",
        username: "testuser",
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

  // Fixed loadLeaderboard function
  const loadLeaderboard = async (currentUserId) => {
    try {
      console.log('🔄 Loading leaderboard for user:', currentUserId);
      setLeaderboardLoading(true);
      
      const leaderboardData = await firebaseService.getLeaderboard(100);
      console.log('📊 Received leaderboard data:', leaderboardData);
      
      setLeaderboard(leaderboardData);
      
      // Find user position
      const position = leaderboardData.findIndex(player => player.userId === currentUserId) + 1;
      setUserPosition(position || 'N/A');
      
      console.log('🏆 User position:', position);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
      console.error('Error details:', error.code, error.message);
      
      // Set empty leaderboard instead of demo data
      setLeaderboard([]);
      setUserPosition('N/A');
    } finally {
      setLeaderboardLoading(false);
    }
  };

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
        setEnergy(progress.energy || 1000);
        setLastPlayed(progress.lastPlayed || null);
        
        // Load leaderboard and user position
        await loadLeaderboard(telegramUser.id);
        
        // Debug database content
        console.log('🔍 Running database debug check...');
        await firebaseService.debugDatabase();
        
        setSaveError(null);
        setConnectionStatus('Connected');
        
        // If it's a new user, create the initial document
        if (progress.isNewUser) {
          console.log('👤 Creating initial user document...');
          await firebaseService.saveUserProgress(telegramUser.id, {
            points: 0,
            level: 1,
            gamesPlayed: 0,
            energy: 1000,
            createdAt: true
          }, telegramUser);
          
          // After creating new user, reload leaderboard
          console.log('🔄 Reloading leaderboard after new user creation...');
          await loadLeaderboard(telegramUser.id);
        }
        
      } catch (error) {
        console.error('❌ Failed to initialize app:', error);
        setSaveError(`Failed to load progress: ${error.message}`);
        setConnectionStatus('Connection failed');
        
        // Set default values on error
        setPoints(0);
        setLevel(1);
        setGamesPlayed(0);
        setEnergy(1000);
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

    // Check if user has energy left
    if (energy <= 0) {
      setSaveError('No energy left! Wait for it to recharge.');
      return;
    }

    const rankInfo = getRankInfo(points);
    const pointsGained = rankInfo.multiplier; // Points gained based on current rank
    const newPoints = points + pointsGained;
    const newLevel = Math.floor(newPoints / 100) + 1;
    const newGamesPlayed = gamesPlayed + 1;
    const newEnergy = energy - 1; // Reduce energy by 1 for each tap
    
    // Update UI immediately for better UX
    setPoints(newPoints);
    setLevel(newLevel);
    setGamesPlayed(newGamesPlayed);
    setEnergy(newEnergy);
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
          gamesPlayed: newGamesPlayed,
          energy: newEnergy
        });
        
        const userData = {
          points: newPoints,
          level: newLevel,
          gamesPlayed: newGamesPlayed,
          energy: newEnergy,
          createdAt: !lastPlayed // Only set createdAt for new users
        };
        
        // Pass user info to save method
        await firebaseService.saveUserProgress(user.id, userData, user);
        
        setLastPlayed(new Date().toISOString());
        
        // Update leaderboard position after significant score changes
        if (newPoints % 100 === 0) {
          await loadLeaderboard(user.id);
        }
        
        console.log('✅ Progress saved successfully');
        
        // Send data back to Telegram bot on level up or every 10 taps
        if ((newLevel > level) || (newPoints % 10 === 0)) {
          sendDataToBot({
            action: 'progress_update',
            points: newPoints,
            level: newLevel,
            gamesPlayed: newGamesPlayed,
            energy: newEnergy
          });
        }
        
      } catch (error) {
        console.error('❌ Failed to save progress:', error);
        setSaveError(`Save failed: ${error.message}`);
        
        // Revert UI changes on error
        setPoints(points);
        setLevel(level);
        setGamesPlayed(gamesPlayed);
        setEnergy(energy);
        
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
          energy: energy,
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
  }, [user, points, level, gamesPlayed, lastPlayed, energy]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-white border-t-transparent mb-4 mx-auto"></div>
          <p className="text-white text-lg">{connectionStatus}</p>
          <p className="text-white/70 text-sm mt-2">Loading your game data</p>
          {user && (
            <div className="text-white/70 text-sm mt-4 space-y-1">
              <p>👤 {user.first_name}</p>
              <p>@{user.username || 'N/A'}</p>
            </div>
          )}
          <div className="text-white/50 text-xs mt-4">
            <p>🔥Database: {firebaseService.initialized ? 'Connected' : 'Connecting...'}</p>
          </div>
        </div>
      </div>
    );
  }

  // Render current page
  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'leaderboard':
        return (
          <LeaderboardPage
            leaderboard={leaderboard}
            userPosition={userPosition}
            user={user}
            isLoading={leaderboardLoading}
          />
        );
      case 'earn':
        return <EarnPage />;
      case 'booster':
        return <BoosterPage />;
      default:
        return (
          <HomePage
            points={points}
            level={level}
            gamesPlayed={gamesPlayed}
            handleTap={handleTap}
            clickAnimation={clickAnimation}
            isOnline={isOnline}
            user={user}
            userPosition={userPosition}
            leaderboard={leaderboard}
            energy={energy}
            setEnergy={setEnergy}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden">
      {/* Firebase Connection Indicator */}
      <div className="absolute top-4 right-4 z-50 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2">
        <div className="flex items-center space-x-2">
          {isOnline && firebaseService.initialized ? (
            <Wifi className="w-3 h-3 text-green-400" />
          ) : (
            <WifiOff className="w-3 h-3 text-red-400" />
          )}
          <div className={`w-2 h-2 rounded-full ${
            isOnline && firebaseService.initialized ? 'bg-green-400' : 'bg-red-400'
          }`}></div>
          <span className="text-xs text-white/80">{connectionStatus}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col">
        {renderCurrentPage()}
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage={currentPage} setCurrentPage={setCurrentPage} />

      {/* Error Messages */}
      {saveError && (
        <div className="fixed bottom-20 left-4 right-4 bg-red-500/90 backdrop-blur-sm rounded-lg p-3 z-50">
          <div className="flex items-center space-x-2">
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{saveError}</span>
          </div>
        </div>
      )}

      {/* Save Indicator */}
      {isSaving && (
        <div className="fixed bottom-20 left-4 right-4 bg-blue-500/90 backdrop-blur-sm rounded-lg p-3 z-50">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            <span className="text-sm">Saving progress...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TelegramMiniApp;