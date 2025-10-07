const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();
 

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
    try {
        console.log('👤 Getting profile for user:', req.userId);
        
        const user = await User.findById(req.userId);

        if (!user) {
            console.log('❌ User not found:', req.userId);
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        console.log('✅ Profile retrieved successfully for:', user.email);
        
        res.json({
            success: true,
            user: user.toJSON()
        });
    } catch (error) {
        console.error('❌ Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching profile',
            ...(process.env.NODE_ENV === 'development' && { 
                error: error.message 
            })
        });
    }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
    try {
        console.log('✏️ Updating profile for user:', req.userId);
        console.log('📦 Update data:', req.body);
        
        const { name, budget, location, email } = req.body;

        const user = await User.findById(req.userId);
        if (!user) {
            console.log('❌ User not found for update:', req.userId);
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update fields if provided
        if (name && name.trim()) {
            user.name = name.trim();
            console.log('📝 Updated name to:', user.name);
        }
        
        if (budget !== undefined && budget >= 0) {
            user.budget = budget;
            console.log('💰 Updated budget to:', user.budget);
        }
        
        if (email && email.trim()) {
            // Check if email is already taken by another user
            const existingUser = await User.findOne({ 
                email: email.toLowerCase().trim(),
                _id: { $ne: req.userId }
            });
            
            if (existingUser) {
                console.log('❌ Email already in use:', email);
                return res.status(400).json({
                    success: false,
                    message: 'Email is already in use by another account'
                });
            }
            
            user.email = email.toLowerCase().trim();
            console.log('📧 Updated email to:', user.email);
        }
        
        if (location) {
            // Handle both object and string formats
            if (typeof location === 'string') {
                const locationParts = location.split(',').map(part => part.trim());
                user.location = {
                    city: locationParts[0] || user.location.city,
                    state: locationParts[1] || user.location.state,
                    country: locationParts[2] || user.location.country
                };
            } else {
                user.location = { 
                    ...user.location.toObject(), 
                    ...location 
                };
            }
            console.log('📍 Updated location to:', user.location);
        }

        await user.save();
        console.log('✅ Profile updated successfully for:', user.email);

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: user.toJSON()
        });
    } catch (error) {
        console.error('❌ Update profile error:', error);

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => ({
                field: err.path,
                message: err.message
            }));
            console.log('❌ Validation errors:', errors);
            
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: errors.map(e => e.message)
            });
        }

        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            console.log('❌ Duplicate key error:', field);
            return res.status(400).json({
                success: false,
                message: `${field} already exists`
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error while updating profile',
            ...(process.env.NODE_ENV === 'development' && { 
                error: error.message 
            })
        });
    }
});

// @route   PUT /api/users/preferences
// @desc    Update user preferences
// @access  Private
router.put('/preferences', auth, async (req, res) => {
    try {
        console.log('🎯 Updating preferences for user:', req.userId);
        console.log('📦 Preferences data:', req.body);
        
        const user = await User.findById(req.userId);

        if (!user) {
            console.log('❌ User not found for preferences update:', req.userId);
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Validate preference data types
        const { cuisines, goals, allergies, dietaryRestrictions } = req.body;
        
        if (cuisines && !Array.isArray(cuisines)) {
            return res.status(400).json({
                success: false,
                message: 'Cuisines must be an array'
            });
        }
        
        if (goals && !Array.isArray(goals)) {
            return res.status(400).json({
                success: false,
                message: 'Goals must be an array'
            });
        }
        
        if (allergies && !Array.isArray(allergies)) {
            return res.status(400).json({
                success: false,
                message: 'Allergies must be an array'
            });
        }
        
        if (dietaryRestrictions && !Array.isArray(dietaryRestrictions)) {
            return res.status(400).json({
                success: false,
                message: 'Dietary restrictions must be an array'
            });
        }

        // Merge new preferences with existing ones
        const currentPreferences = user.preferences.toObject();
        const updatedPreferences = {
            ...currentPreferences,
            ...req.body
        };

        console.log('🔄 Merging preferences:', {
            current: currentPreferences,
            new: req.body,
            result: updatedPreferences
        });

        user.preferences = updatedPreferences;
        await user.save();
        
        console.log('✅ Preferences updated successfully for:', user.email);

        res.json({
            success: true,
            message: 'Preferences updated successfully',
            preferences: user.preferences
        });
    } catch (error) {
        console.error('❌ Update preferences error:', error);

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => ({
                field: err.path,
                message: err.message
            }));
            console.log('❌ Validation errors:', errors);
            
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: errors.map(e => e.message)
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error while updating preferences',
            ...(process.env.NODE_ENV === 'development' && { 
                error: error.message 
            })
        });
    }
});

// @route   PUT /api/users/budget
// @desc    Update user budget
// @access  Private
router.put('/budget', auth, async (req, res) => {
    try {
        console.log('💰 Updating budget for user:', req.userId);
        console.log('📦 Budget data:', req.body);
        
        const { budget } = req.body;

        // Validate budget
        if (budget === undefined || budget === null) {
            return res.status(400).json({
                success: false,
                message: 'Budget is required'
            });
        }
        
        if (typeof budget !== 'number' || budget < 0) {
            return res.status(400).json({
                success: false,
                message: 'Budget must be a non-negative number'
            });
        }
        
        if (budget > 10000) {
            return res.status(400).json({
                success: false,
                message: 'Budget cannot exceed $10,000'
            });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            console.log('❌ User not found for budget update:', req.userId);
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const oldBudget = user.budget;
        user.budget = budget;
        await user.save();
        
        console.log(`✅ Budget updated from $${oldBudget} to $${budget} for:`, user.email);

        res.json({
            success: true,
            message: 'Budget updated successfully',
            budget: user.budget
        });
    } catch (error) {
        console.error('❌ Update budget error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating budget',
            ...(process.env.NODE_ENV === 'development' && { 
                error: error.message 
            })
        });
    }
});

// @route   GET /api/users/preferences
// @desc    Get user preferences only
// @access  Private
router.get('/preferences', auth, async (req, res) => {
    try {
        console.log('🎯 Getting preferences for user:', req.userId);
        
        const user = await User.findById(req.userId).select('preferences');

        if (!user) {
            console.log('❌ User not found for preferences:', req.userId);
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        console.log('✅ Preferences retrieved successfully');

        res.json({
            success: true,
            preferences: user.preferences
        });
    } catch (error) {
        console.error('❌ Get preferences error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching preferences',
            ...(process.env.NODE_ENV === 'development' && { 
                error: error.message 
            })
        });
    }
});

// @route   DELETE /api/users/account
// @desc    Deactivate user account
// @access  Private
router.delete('/account', auth, async (req, res) => {
    try {
        console.log('🗑️ Deactivating account for user:', req.userId);
        
        const user = await User.findById(req.userId);

        if (!user) {
            console.log('❌ User not found for deactivation:', req.userId);
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Deactivate instead of delete for data integrity
        user.isActive = false;
        await user.save();
        
        console.log('✅ Account deactivated successfully for:', user.email);

        res.json({
            success: true,
            message: 'Account deactivated successfully'
        });
    } catch (error) {
        console.error('❌ Deactivate account error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deactivating account',
            ...(process.env.NODE_ENV === 'development' && { 
                error: error.message 
            })
        });
    }
});

// @route   PUT /api/users/reactivate
// @desc    Reactivate deactivated account
// @access  Private
router.put('/reactivate', auth, async (req, res) => {
    try {
        console.log('🔄 Reactivating account for user:', req.userId);
        
        const user = await User.findById(req.userId);

        if (!user) {
            console.log('❌ User not found for reactivation:', req.userId);
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.isActive = true;
        await user.save();
        
        console.log('✅ Account reactivated successfully for:', user.email);

        res.json({
            success: true,
            message: 'Account reactivated successfully',
            user: user.toJSON()
        });
    } catch (error) {
        console.error('❌ Reactivate account error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while reactivating account',
            ...(process.env.NODE_ENV === 'development' && { 
                error: error.message 
            })
        });
    }
});

// @route   GET /api/users/stats
// @desc    Get user statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
    try {
        console.log('📊 Getting stats for user:', req.userId);
        
        const user = await User.findById(req.userId);

        if (!user) {
            console.log('❌ User not found for stats:', req.userId);
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const stats = {
            memberSince: user.createdAt,
            lastLogin: user.lastLogin,
            totalCuisines: user.preferences.cuisines.length,
            totalGoals: user.preferences.goals.length,
            totalAllergies: user.preferences.allergies.length,
            budget: user.budget,
            isActive: user.isActive
        };

        console.log('✅ Stats retrieved successfully');

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('❌ Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching stats',
            ...(process.env.NODE_ENV === 'development' && { 
                error: error.message 
            })
        });
    }
});


module.exports = router;
