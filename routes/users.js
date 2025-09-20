const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user: user.toJSON()
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
    try {
        const { name, budget, location } = req.body;

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update fields if provided
        if (name) user.name = name.trim();
        if (budget !== undefined && budget >= 0) user.budget = budget;
        if (location) {
            user.location = { 
                ...user.location, 
                ...location 
            };
        }

        await user.save();

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: user.toJSON()
        });
    } catch (error) {
        console.error('Update profile error:', error);

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   PUT /api/users/preferences
// @desc    Update user preferences
// @access  Private
router.put('/preferences', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Merge new preferences with existing ones
        const updatedPreferences = {
            ...user.preferences.toObject(),
            ...req.body
        };

        user.preferences = updatedPreferences;
        await user.save();

        res.json({
            success: true,
            message: 'Preferences updated successfully',
            preferences: user.preferences
        });
    } catch (error) {
        console.error('Update preferences error:', error);

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   PUT /api/users/budget
// @desc    Update user budget
// @access  Private
router.put('/budget', auth, async (req, res) => {
    try {
        const { budget } = req.body;

        if (budget === undefined || budget < 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid budget is required (must be non-negative)'
            });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.budget = budget;
        await user.save();

        res.json({
            success: true,
            message: 'Budget updated successfully',
            budget: user.budget
        });
    } catch (error) {
        console.error('Update budget error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/users/preferences
// @desc    Get user preferences only
// @access  Private
router.get('/preferences', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('preferences');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            preferences: user.preferences
        });
    } catch (error) {
        console.error('Get preferences error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   DELETE /api/users/account
// @desc    Deactivate user account
// @access  Private
router.delete('/account', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Deactivate instead of delete for data integrity
        user.isActive = false;
        await user.save();

        res.json({
            success: true,
            message: 'Account deactivated successfully'
        });
    } catch (error) {
        console.error('Deactivate account error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;