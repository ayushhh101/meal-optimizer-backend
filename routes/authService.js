import axios from 'axios';

// Create axios instance with base configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 10000, // 10 second timeout
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    console.log(`🔗 Making ${config.method?.toUpperCase()} request to:`, config.url);
    console.log('📦 Request data:', config.data);
    
    const token = localStorage.getItem('token');
    if (token) {
      const cleanToken = token.replace('Bearer ', '');
      config.headers.Authorization = `Bearer ${cleanToken}`;
    }
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for handling common errors
api.interceptors.response.use(
  (response) => {
    console.log('✅ Response received:', {
      status: response.status,
      data: response.data
    });
    return response;
  },
  (error) => {
    console.error('❌ Response interceptor error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Don't redirect automatically during registration/login
      const currentPath = window.location.pathname;
      if (!currentPath.includes('onboarding') && !currentPath.includes('login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authService = {
  // Register new user
  register: async (userData) => {
    try {
      console.log('📝 Attempting to register user:', {
        ...userData,
        password: '[HIDDEN]'
      });
      
      const response = await api.post('/api/auth/register', userData);
      
      if (response.data.success && response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        console.log('✅ Registration successful, user stored');
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ Registration error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      throw {
        success: false,
        message: error.response?.data?.message || error.message || 'Registration failed. Please try again.',
        errors: error.response?.data?.errors || []
      };
    }
  },

  // Login existing user
  login: async (credentials) => {
    try {
      console.log('🔑 Attempting to login user:', credentials.email);
      
      const response = await api.post('/api/auth/login', credentials);
      
      if (response.data.success && response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        console.log('✅ Login successful');
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ Login error:', error);
      throw {
        success: false,
        message: error.response?.data?.message || 'Login failed. Please try again.'
      };
    }
  },

  // Get current user info
  getCurrentUser: async () => {
    try {
      const response = await api.get('/api/auth/me');
      
      if (response.data.success && response.data.user) {
        // Update stored user data
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ Get current user error:', error);
      throw {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch user info'
      };
    }
  },

  // Refresh user data from server
  refreshUser: async () => {
    try {
      console.log('🔄 Refreshing user data from server...');
      const response = await authService.getCurrentUser();
      return response.user;
    } catch (error) {
      console.error('❌ Failed to refresh user data:', error);
      throw error;
    }
  },

  // Logout user
  logout: async () => {
    try {
      console.log('👋 Logging out user...');
      await api.post('/api/auth/logout');
      console.log('✅ Logout successful');
    } catch (error) {
      console.error('❌ Logout error (continuing anyway):', error);
    } finally {
      // Always clear local storage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      console.log('🧹 Local storage cleared');
    }
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    return !!(token && user);
  },

  // Get stored user
  getStoredUser: () => {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    } catch (error) {
      console.error('❌ Error parsing stored user:', error);
      return null;
    }
  },

  // Update stored user data
  updateStoredUser: (userData) => {
    try {
      localStorage.setItem('user', JSON.stringify(userData));
      console.log('✅ User data updated in storage');
    } catch (error) {
      console.error('❌ Error updating stored user:', error);
    }
  }
};

export const userService = {
  // Get user profile
  getProfile: async () => {
    try {
      console.log('👤 Fetching user profile...');
      const response = await api.get('/api/users/profile');
      return response.data;
    } catch (error) {
      console.error('❌ Get profile error:', error);
      throw {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch profile'
      };
    }
  },

  // Update user profile (name, email, location)
  updateProfile: async (profileData) => {
    try {
      console.log('✏️ Updating user profile:', profileData);
      const response = await api.put('/api/users/profile', profileData);
      
      if (response.data.success && response.data.user) {
        // Update stored user info
        authService.updateStoredUser(response.data.user);
        console.log('✅ Profile updated successfully');
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ Update profile error:', error);
      throw {
        success: false,
        message: error.response?.data?.message || 'Failed to update profile',
        errors: error.response?.data?.errors || []
      };
    }
  },

  // Update user preferences
  updatePreferences: async (preferences) => {
    try {
      console.log('🎯 Updating user preferences:', preferences);
      const response = await api.put('/api/users/preferences', preferences);
      
      if (response.data.success) {
        // Refresh user data to get updated preferences
        try {
          await authService.refreshUser();
        } catch (refreshError) {
          console.warn('⚠️ Failed to refresh user data after preference update');
        }
        console.log('✅ Preferences updated successfully');
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ Update preferences error:', error);
      throw {
        success: false,
        message: error.response?.data?.message || 'Failed to update preferences',
        errors: error.response?.data?.errors || []
      };
    }
  },

  // Get user preferences only
  getPreferences: async () => {
    try {
      console.log('🎯 Fetching user preferences...');
      const response = await api.get('/api/users/preferences');
      return response.data;
    } catch (error) {
      console.error('❌ Get preferences error:', error);
      throw {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch preferences'
      };
    }
  },

  // Update user budget
  updateBudget: async (budget) => {
    try {
      console.log('💰 Updating user budget to:', budget);
      const response = await api.put('/api/users/budget', { budget });
      
      if (response.data.success) {
        // Update stored user data
        const currentUser = authService.getStoredUser();
        if (currentUser) {
          currentUser.budget = budget;
          authService.updateStoredUser(currentUser);
        }
        console.log('✅ Budget updated successfully');
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ Update budget error:', error);
      throw {
        success: false,
        message: error.response?.data?.message || 'Failed to update budget'
      };
    }
  },

  // Get user statistics
  getStats: async () => {
    try {
      console.log('📊 Fetching user statistics...');
      const response = await api.get('/api/users/stats');
      return response.data;
    } catch (error) {
      console.error('❌ Get stats error:', error);
      throw {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch statistics'
      };
    }
  },

  // Deactivate account
  deactivateAccount: async () => {
    try {
      console.log('🗑️ Deactivating user account...');
      const response = await api.delete('/api/users/account');
      
      if (response.data.success) {
        // Clear stored data after deactivation
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        console.log('✅ Account deactivated successfully');
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ Deactivate account error:', error);
      throw {
        success: false,
        message: error.response?.data?.message || 'Failed to deactivate account'
      };
    }
  },

  // Reactivate account
  reactivateAccount: async () => {
    try {
      console.log('🔄 Reactivating user account...');
      const response = await api.put('/api/users/reactivate');
      
      if (response.data.success && response.data.user) {
        authService.updateStoredUser(response.data.user);
        console.log('✅ Account reactivated successfully');
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ Reactivate account error:', error);
      throw {
        success: false,
        message: error.response?.data?.message || 'Failed to reactivate account'
      };
    }
  }
};

// Utility functions for common operations
export const authUtils = {
  // Check if token is expired (basic check)
  isTokenExpired: () => {
    const token = localStorage.getItem('token');
    if (!token) return true;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp < currentTime;
    } catch (error) {
      console.error('❌ Error checking token expiration:', error);
      return true;
    }
  },

  // Format user display name
  formatUserName: (user) => {
    if (!user) return 'User';
    return user.name || user.email?.split('@')[0] || 'User';
  },

  // Get user initials for avatar
  getUserInitials: (user) => {
    if (!user || !user.name) return 'U';
    return user.name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  },

  // Validate authentication state
  validateAuthState: async () => {
    try {
      if (!authService.isAuthenticated()) {
        return { isValid: false, reason: 'Not authenticated' };
      }

      if (authUtils.isTokenExpired()) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return { isValid: false, reason: 'Token expired' };
      }

      // Optional: Verify with server
      try {
        await authService.getCurrentUser();
        return { isValid: true };
      } catch (error) {
        return { isValid: false, reason: 'Server verification failed' };
      }
    } catch (error) {
      console.error('❌ Auth validation error:', error);
      return { isValid: false, reason: 'Validation error' };
    }
  }
};

export default api;
