// Enhanced Firebase Service Implementation with Task System and Boosters
import React, { useState, useEffect } from 'react';
import { Trophy, Star, Zap, User, Wifi, WifiOff, Home, DollarSign, HelpCircle, ExternalLink, Check } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, query, orderBy, limit, getDocs, serverTimestamp, updateDoc, arrayUnion } from 'firebase/firestore';
import { getAuth, signInWithCustomToken, signInAnonymously, connectAuthEmulator } from 'firebase/auth';
import Maxlogo from './assets/logo.png'; // Import your logo here

// Firebase configuration - MAKE SURE THIS MATCHES YOUR PROJECT
const firebaseConfig = {
  apiKey: "AIzaSyDx77ZNDIT-56mHzwQp6wglRURUZGg-KS0",
  authDomain: "tgbot-4d504.firebaseapp.com",
  projectId: "tgbot-4d504",
  storageBucket: "tgbot-4d504.firebasestorage.app",
  messagingSenderId: "826370102389",
  appId: "1:826370102389:web:4d1755bc152b9d706ed43c"
};

// Task definitions
const TASKS = [
  {
    id: 'twitter_follow',
    title: 'Follow on X',
    description: 'Follow our official Twitter account',
    reward: 5000,
    icon: '𝕏',
    iconBg: 'bg-blue-500',
    url: 'https://twitter.com/your_account',
    type: 'external'
  },
  {
    id: 'tiktok_follow',
    title: 'Follow on TikTok',
    description: 'Follow us on TikTok',
    reward: 5000,
    icon: '🎵',
    iconBg: 'bg-pink-500',
    url: 'https://tiktok.com/@your_account',
    type: 'external'
  },
  {
    id: 'like_comment',
    title: 'Like & Comment',
    description: 'Like our post and comment',
    reward: 3000,
    icon: '❤️',
    iconBg: 'bg-red-500',
    url: 'https://twitter.com/your_post',
    type: 'external'
  },
  {
    id: 'telegram_channel',
    title: 'Join Telegram',
    description: 'Join our Telegram channel',
    reward: 7000,
    icon: '📢',
    iconBg: 'bg-blue-600',
    url: 'https://t.me/your_channel',
    type: 'telegram'
  }
];

// Booster definitions
const BOOSTERS = [
  {
    id: 'energy_booster',
    title: 'Energy Booster',
    description: 'Increase max energy to 6000',
    cost: 50000,
    icon: '⚡',
    iconBg: 'bg-purple-600',
    color: 'bg-purple-600',
    benefit: 'maxEnergy',
    value: 6000
  },
  {
    id: 'multi_tap',
    title: 'Multi Tap',
    description: 'Earn 2 coins per tap',
    cost: 100000,
    icon: '$',
    iconBg: 'bg-green-600',
    color: 'bg-green-600',
    benefit: 'coinsPerTap',
    value: 2
  },
  {
    id: 'auto_tap',
    title: 'Auto Tap',
    description: 'Earn coins automatically for 1 hour',
    cost: 200000,
    icon: '🤖',
    iconBg: 'bg-orange-600',
    color: 'bg-orange-600',
    benefit: 'autoTap',
    value: 1 // 1 hour
  }
];

// Enhanced Firebase service class with task management
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
        lastEnergyRefresh: userData.lastEnergyRefresh || Date.now(),
        completedTasks: userData.completedTasks || [],
        purchasedBoosters: userData.purchasedBoosters || [],
        maxEnergy: userData.maxEnergy || 1000,
        coinsPerTap: userData.coinsPerTap || 1,
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

  async completeTask(userId, taskId, reward) {
    try {
      await this.init();
      await this.ensureAuth();
      
      console.log('🎯 Completing task...', { userId, taskId, reward });
      
      const userRef = doc(this.db, 'users', userId.toString());
      
      // Get current user data
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }
      
      const userData = userDoc.data();
      const completedTasks = userData.completedTasks || [];
      
      // Check if task is already completed
      if (completedTasks.includes(taskId)) {
        throw new Error('Task already completed');
      }
      
      // Update user data with completed task and reward
      const updatedData = {
        points: (userData.points || 0) + reward,
        completedTasks: [...completedTasks, taskId],
        level: Math.floor(((userData.points || 0) + reward) / 100) + 1,
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(userRef, updatedData);
      
      console.log('✅ Task completed successfully');
      return { 
        success: true, 
        newPoints: updatedData.points,
        newLevel: updatedData.level,
        completedTasks: updatedData.completedTasks
      };
      
    } catch (error) {
      console.error('❌ Task completion failed:', error);
      throw error;
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
          lastEnergyRefresh: data.lastEnergyRefresh || Date.now(),
          completedTasks: data.completedTasks || [],
          purchasedBoosters: data.purchasedBoosters || [],
          maxEnergy: data.maxEnergy || 1000,
          coinsPerTap: data.coinsPerTap || 1,
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
          lastEnergyRefresh: Date.now(),
          completedTasks: [],
          purchasedBoosters: [],
          maxEnergy: 1000,
          coinsPerTap: 1,
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
const formatCountdownTimer = (energy, maxEnergy, lastEnergyRefresh) => {
  if (energy >= maxEnergy) return 'Full Energy!';
  
  const now = Date.now();
  const timeSinceLastRefresh = now - lastEnergyRefresh;
  const twoHoursInMs = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
  const timeUntilRefresh = twoHoursInMs - timeSinceLastRefresh;
  
  if (timeUntilRefresh <= 0) {
    return 'Energy ready to refresh!';
  }
  
  const hours = Math.floor(timeUntilRefresh / (60 * 60 * 1000));
  const minutes = Math.floor((timeUntilRefresh % (60 * 60 * 1000)) / (60 * 1000));
  
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
  setEnergy,
  lastEnergyRefresh,
  maxEnergy
}) => {
  const tapsLeft = energy;
  
  const rankInfo = getRankInfo(points);

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center">
            <span><img src={Maxlogo} alt="Max_io" /></span>
          </div>
          <span className="text-white font-medium">Max_io</span>
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
          {/* Outer circle */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-gray-400 to-gray-600 flex items-center justify-center">
            <div className="w-44 h-44 bg-black rounded-full flex items-center justify-center">
              <div className=" rounded-full flex items-center justify-center">
                <span><img src={Maxlogo} alt="Max_io" className=' w-20 h-16 left-13 bottom-16 absolute' /></span>
              </div>
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
          <p className="text-white/60 text-sm">{formatCountdownTimer(energy, maxEnergy, lastEnergyRefresh)}</p>
        </div>
      </div>
    </div>
  );
};

// Enhanced Earn Page Component with Tasks - Scrollable
const EarnPage = ({ completedTasks, onTaskComplete, isProcessing }) => {
  const handleTaskClick = async (task) => {
    if (completedTasks.includes(task.id) || isProcessing) {
      return;
    }

    // Open the URL in a new tab/window
    if (task.url) {
      window.open(task.url, '_blank');
    }

    // Wait a bit to simulate the user completing the task
    setTimeout(() => {
      onTaskComplete(task);
    }, 2000);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-shrink-0 text-center p-6 pb-4">
        <div className="flex items-center justify-center mb-3">
          <DollarSign className="w-10 h-10 text-green-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Complete Tasks</h2>
        <p className="text-white/60 text-sm">Earn extra coins by completing tasks</p>
      </div>

      {/* Scrollable Tasks List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="space-y-3">
          {TASKS.map((task) => {
            const isCompleted = completedTasks.includes(task.id);
            
            return (
              <div
                key={task.id}
                className={`bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 transition-all duration-300 ${
                  isCompleted 
                    ? 'opacity-60 bg-green-800/30 border border-green-600/30' 
                    : 'hover:bg-gray-700/50 cursor-pointer border border-gray-700/50'
                } ${isProcessing ? 'pointer-events-none opacity-75' : ''}`}
                onClick={() => handleTaskClick(task)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {/* Task Icon */}
                    <div className={`w-10 h-10 ${isCompleted ? 'bg-green-600' : task.iconBg} rounded-full flex items-center justify-center transition-all duration-300`}>
                      {isCompleted ? (
                        <Check className="w-5 h-5 text-white" />
                      ) : (
                        <span className="text-lg">{task.icon}</span>
                      )}
                    </div>
                    
                    {/* Task Info */}
                    <div className="flex-1">
                      <h3 className={`font-semibold ${isCompleted ? 'text-green-400' : 'text-white'}`}>
                        {task.title}
                      </h3>
                      <p className="text-white/60 text-sm">
                        {task.description}
                      </p>
                    </div>
                  </div>
                  
                  {/* Reward */}
                  <div className="text-right">
                    <div className={`font-bold ${isCompleted ? 'text-green-400' : 'text-yellow-400'}`}>
                      {isCompleted ? '✓' : `+${task.reward.toLocaleString()}`}
                    </div>
                    {!isCompleted && (
                      <div className="flex items-center text-white/60 text-xs mt-1">
                        <ExternalLink className="w-3 h-3 mr-1" />
                        <span>Link</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Completion Summary */}
        <div className="mt-6 bg-gray-800/30 rounded-lg p-4">
          <p className="text-white/60 text-sm text-center mb-2">
            Completed: {completedTasks.length} / {TASKS.length} tasks
          </p>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${(completedTasks.length / TASKS.length) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Leaderboard Page Component
const LeaderboardPage = () => (
  <div className="flex-1 p-6">
    <div className="text-center">
      <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-white mb-2">Leaderboard</h2>
      <p className="text-white/60">Coming Soon...</p>
    </div>
  </div>
);

// Enhanced Booster Page Component
const BoosterPage = ({ points, onBoosterPurchase, purchasedBoosters }) => {
  const handleBoosterClick = (booster) => {
    if (points >= booster.cost && !purchasedBoosters?.includes(booster.id)) {
      onBoosterPurchase(booster);
    }
  };

  return (
   <div className="flex-1 flex flex-col overflow-hidden">
      {/* Fixed Header - Reduced padding */}
      <div className="flex-shrink-0 text-center p-4 pb-3">
        <div className="flex items-center justify-center mb-2">
          <Zap className="w-8 h-8 text-purple-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Power Up</h2>
        <p className="text-white/60 text-sm">Increase your tapping power and earnings</p>
      </div>

      {/* Scrollable Boosters List - Reduced padding */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="space-y-1.5">
          {BOOSTERS.map((booster) => {
            const canAfford = points >= booster.cost;
            const isPurchased = purchasedBoosters?.includes(booster.id);
            const isClickable = canAfford && !isPurchased;
            
            return (
              <div
                key={booster.id}
                className={`rounded-lg p-3 transition-all duration-300 ${
                  isPurchased
                    ? 'bg-gray-800/30 border border-gray-600/30 opacity-60'
                    : canAfford
                    ? `bg-gradient-to-r from-gray-800 to-gray-700 border border-gray-600 hover:scale-105 cursor-pointer`
                    : 'bg-gray-800/30 border border-gray-700/30 opacity-50 cursor-not-allowed'
                }`}
                onClick={() => handleBoosterClick(booster)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2.5">
                    {/* Booster Icon - Smaller size */}
                    <div className={`w-10 h-10 ${isPurchased ? 'bg-gray-600' : booster.iconBg} rounded-full flex items-center justify-center`}>
                      {isPurchased ? (
                        <Check className="w-4 h-4 text-white" />
                      ) : (
                        <span className="text-base">{booster.icon}</span>
                      )}
                    </div>
                    
                    {/* Booster Info - Reduced font sizes */}
                    <div className="flex-1">
                      <h3 className={`font-semibold text-sm ${isPurchased ? 'text-gray-400' : 'text-white'}`}>
                        {booster.title}
                      </h3>
                      <p className="text-white/60 text-xs leading-tight">
                        {booster.description}
                      </p>
                    </div>
                  </div>
                  
                  {/* Cost - Smaller text */}
                  <div className="text-right">
                    <div className={`font-bold text-sm ${
                      isPurchased 
                        ? 'text-green-400' 
                        : canAfford 
                        ? 'text-yellow-400' 
                        : 'text-red-400'
                    }`}>
                      {isPurchased ? 'Owned' : `${booster.cost.toLocaleString()}`}
                    </div>
                    {!isPurchased && (
                      <div className="text-white/60 text-xs">coins</div>
                    )}
                  </div>
                </div>
                
                {/* Buy Button - Reduced padding */}
                <button
                  className={`w-full py-2 rounded-lg font-normal text-xs text-white transition-all duration-300 ${
                    isPurchased
                      ? 'bg-gray-600 cursor-not-allowed'
                      : canAfford
                      ? `${booster.color} hover:opacity-90 active:scale-95`
                      : 'bg-gray-700 cursor-not-allowed opacity-50'
                  }`}
                  disabled={!isClickable}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBoosterClick(booster);
                  }}
                >
                  {isPurchased ? 'Owned' : canAfford ? 'Buy Booster' : `Need ${(booster.cost - points).toLocaleString()} more coins`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Current Points Display - Reduced size */}
        <div className="mt-2 bg-gray-800/30 rounded-lg p-3">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center">
              <span className="text-black font-bold text-xs">$</span>
            </div>
            <span className="text-white font-bold text-base">{points.toLocaleString()}</span>
            <span className="text-white/60 text-sm">coins available</span>
          </div>
        </div>
      </div>
    </div>
  );
};

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
  const [lastEnergyRefresh, setLastEnergyRefresh] = useState(Date.now());
  const [completedTasks, setCompletedTasks] = useState([]);
  const [isProcessingTask, setIsProcessingTask] = useState(false);
  const [purchasedBoosters, setPurchasedBoosters] = useState([]);
  const [maxEnergy, setMaxEnergy] = useState(1000);
  const [coinsPerTap, setCoinsPerTap] = useState(1);

  const originalMaxEnergy = 1000;

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

  // Save user data helper function
  const saveUserData = async (userData) => {
    if (user) {
      try {
        const dataToSave = {
          points: userData.coins || points,
          level: userData.level || level,
          gamesPlayed: userData.totalTaps || gamesPlayed,
          energy: userData.energy || energy,
          lastEnergyRefresh: userData.lastEnergyRefresh || lastEnergyRefresh,
          completedTasks: completedTasks,
          purchasedBoosters: purchasedBoosters,
          maxEnergy: maxEnergy,
          coinsPerTap: coinsPerTap
        };
        
        await firebaseService.saveUserProgress(user.id, dataToSave, user);
        console.log('✅ User data saved successfully');
      } catch (error) {
        console.error('❌ Failed to save user data:', error);
      }
    }
  };

  // Energy refresh system
  useEffect(() => {
    const checkEnergyRefresh = () => {
      const now = Date.now();
      const timeSinceLastRefresh = now - lastEnergyRefresh;
      const twoHoursInMs = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

      if (timeSinceLastRefresh >= twoHoursInMs && energy < maxEnergy) {
        setEnergy(maxEnergy);
        setLastEnergyRefresh(now);
        saveUserData({
          coins: points,
          totalTaps: gamesPlayed,
          energy: maxEnergy,
          lastEnergyRefresh: now,
          username: user?.username || user?.first_name || "Anonymous",
          firstName: user?.first_name || "User"
        });
      }
    };

    checkEnergyRefresh();
    const interval = setInterval(checkEnergyRefresh, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [lastEnergyRefresh, maxEnergy, user, energy, points, gamesPlayed, purchasedBoosters, coinsPerTap]);

  // Load leaderboard and calculate user position
  const loadLeaderboard = async (currentUserId) => {
    try {
      const leaderboardData = await firebaseService.getLeaderboard(100);
      setLeaderboard(leaderboardData);
      
      // Find user position
      const position = leaderboardData.findIndex(player => player.userId === currentUserId) + 1;
      setUserPosition(position || 'N/A');
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    }
  };

  // Handle booster purchase
  const handleBoosterPurchase = async (booster) => {
    if (points < booster.cost || purchasedBoosters.includes(booster.id)) {
      return;
    }

    try {
      const newPoints = points - booster.cost;
      const newPurchasedBoosters = [...purchasedBoosters, booster.id];
      
      // Update local state immediately
      setPoints(newPoints);
      setPurchasedBoosters(newPurchasedBoosters);
      
      // Apply booster effects
      switch (booster.benefit) {
        case 'maxEnergy':
          setMaxEnergy(booster.value);
          setEnergy(booster.value); // Fill energy to new max
          break;
        case 'coinsPerTap':
          setCoinsPerTap(booster.value);
          break;
        case 'autoTap':
          // Auto tap implementation would go here
          console.log('Auto tap activated for', booster.value, 'hour(s)');
          break;
      }
      
      // Save to Firebase
      if (user) {
        const userData = {
          points: newPoints,
          level: level,
          gamesPlayed: gamesPlayed,
          energy: booster.benefit === 'maxEnergy' ? booster.value : energy,
          lastEnergyRefresh: lastEnergyRefresh,
          completedTasks: completedTasks,
          purchasedBoosters: newPurchasedBoosters,
          maxEnergy: booster.benefit === 'maxEnergy' ? booster.value : maxEnergy,
          coinsPerTap: booster.benefit === 'coinsPerTap' ? booster.value : coinsPerTap
        };
        
        await firebaseService.saveUserProgress(user.id, userData, user);
        
        // Send to bot
        sendDataToBot({
          action: 'booster_purchased',
          boosterId: booster.id,
          cost: booster.cost,
          points: newPoints,
          benefit: booster.benefit,
          value: booster.value
        });
      }
      
      console.log('✅ Booster purchased successfully:', booster.title);
      
    } catch (error) {
      console.error('❌ Booster purchase failed:', error);
      setSaveError(`Failed to purchase booster: ${error.message}`);
      
      // Revert changes on error
      setPoints(points);
      setPurchasedBoosters(purchasedBoosters);
    }
  };

  // Handle task completion
  const handleTaskComplete = async (task) => {
    if (completedTasks.includes(task.id) || isProcessingTask) {
      return;
    }

    setIsProcessingTask(true);
    setSaveError(null);

    try {
      console.log('🎯 Completing task:', task.id);
      
      const result = await firebaseService.completeTask(user.id, task.id, task.reward);
      
      // Update local state
      setPoints(result.newPoints);
      setLevel(result.newLevel);
      setCompletedTasks(result.completedTasks);
      
      // Update leaderboard position
      await loadLeaderboard(user.id);
      
      // Send data back to Telegram bot
      sendDataToBot({
        action: 'task_completed',
        taskId: task.id,
        reward: task.reward,
        points: result.newPoints,
        level: result.newLevel
      });
      
      console.log('✅ Task completed successfully:', task.title);
      
    } catch (error) {
      console.error('❌ Task completion failed:', error);
      setSaveError(`Failed to complete task: ${error.message}`);
    } finally {
      setIsProcessingTask(false);
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
        
        // Load user progress from Firebase
        const progress = await firebaseService.getUserProgress(telegramUser.id);
        
        console.log('📊 Loaded progress:', progress);
        
        setPoints(progress.points || 0);
        setLevel(progress.level || 1);
        setGamesPlayed(progress.gamesPlayed || 0);
        setEnergy(progress.energy || 1000);
        setLastEnergyRefresh(progress.lastEnergyRefresh || Date.now());
        setCompletedTasks(progress.completedTasks || []);
        setPurchasedBoosters(progress.purchasedBoosters || []);
        setMaxEnergy(progress.maxEnergy || 1000);
        setCoinsPerTap(progress.coinsPerTap || 1);
        setLastPlayed(progress.lastPlayed || null);
        
        // Load leaderboard and user position
        await loadLeaderboard(telegramUser.id);
        
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
            lastEnergyRefresh: Date.now(),
            completedTasks: [],
            purchasedBoosters: [],
            maxEnergy: 1000,
            coinsPerTap: 1,
            createdAt: true
          }, telegramUser);
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
        setLastEnergyRefresh(Date.now());
        setCompletedTasks([]);
        setPurchasedBoosters([]);
        setMaxEnergy(1000);
        setCoinsPerTap(1);
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
    const basePointsGained = rankInfo.multiplier;
    const pointsGained = basePointsGained * coinsPerTap; // Apply coins per tap multiplier
    const newPoints = points + pointsGained;
    const newLevel = Math.floor(newPoints / 100) + 1;
    const newGamesPlayed = gamesPlayed + 1;
    const newEnergy = energy - 1;
    
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
          lastEnergyRefresh: lastEnergyRefresh,
          completedTasks: completedTasks,
          purchasedBoosters: purchasedBoosters,
          maxEnergy: maxEnergy,
          coinsPerTap: coinsPerTap,
          createdAt: !lastPlayed
        };
        
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
          completedTasks: completedTasks,
          purchasedBoosters: purchasedBoosters,
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
  }, [user, points, level, gamesPlayed, lastPlayed, energy, completedTasks, purchasedBoosters]);

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
          <div className="text-white/50 text-xs mt-4 flex items-center justify-center space-x-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center">
              <span><img src={Maxlogo} alt="Max_io" /></span>
            </div>
            <span>Max_io: {firebaseService.initialized ? 'Connected' : 'Connecting...'}</span>
          </div>
        </div>
      </div>
    );
  }

  // Render current page
  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'leaderboard':
        return <LeaderboardPage />;
      case 'earn':
        return (
          <EarnPage 
            completedTasks={completedTasks}
            onTaskComplete={handleTaskComplete}
            isProcessing={isProcessingTask}
          />
        );
      case 'booster':
        return (
          <BoosterPage 
            points={points}
            onBoosterPurchase={handleBoosterPurchase}
            purchasedBoosters={purchasedBoosters}
          />
        );
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
            lastEnergyRefresh={lastEnergyRefresh}
            maxEnergy={maxEnergy}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden">
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

      {/* Task Completion Success Message */}
      {isProcessingTask && (
        <div className="fixed bottom-20 left-4 right-4 bg-green-500/90 backdrop-blur-sm rounded-lg p-3 z-50">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            <span className="text-sm">Completing task...</span>
          </div>
        </div>
      )}

      {/* Booster Purchase Success Message */}
      {isSaving && (
        <div >
          {/* <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            <span className="text-sm">Saving progress...</span>
          </div> */}
        </div>
      )}
    </div>
  );
};

export default TelegramMiniApp;