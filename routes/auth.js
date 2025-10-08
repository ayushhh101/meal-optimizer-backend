const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// Generate JWT Token with basic user info
const generateToken = (user) => {
    return jwt.sign(
        {
            _id: user._id,
            name: user.name,
            email: user.email,
            isActive: user.isActive
        },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );
};

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', async (req, res) => {
    try {
        console.log('📝 Registration request received:', {
            body: req.body,
            headers: req.headers['content-type']
        });

        const { name, email, password, budget, preferences, location } = req.body;

        // Enhanced Validation
        const errors = [];
        
        if (!name || name.trim().length === 0) {
            errors.push('Name is required');
        }
        if (!email || email.trim().length === 0) {
            errors.push('Email is required');
        }
        if (!password || password.length === 0) {
            errors.push('Password is required');
        }
        
        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (email && !emailRegex.test(email)) {
            errors.push('Please provide a valid email address');
        }
        
        // Password length validation
        if (password && password.length < 6) {
            errors.push('Password must be at least 6 characters long');
        }

        if (errors.length > 0) {
            console.log('❌ Validation errors:', errors);
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) {
            console.log('❌ User already exists:', email);
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        // Create new user with proper defaults
        const userData = {
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password: password,
            budget: budget || 75,
            location: location || { city: 'Unknown', state: 'Unknown', country: 'India' },
            preferences: preferences || {
                cuisines: [],
                goals: [],
                allergies: [],
                dietaryRestrictions: []
            }
        };

        console.log('🔍 Creating user with data:', {
            ...userData,
            password: '[HIDDEN]' // Don't log password
        });

        const user = new User(userData);
        await user.save();

        console.log('✅ User created successfully:', user._id);

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate JWT token with user info
        const token = generateToken(user);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
            user: user.toJSON()
        });
    } catch (error) {
        console.error('❌ Registration error:', error);

        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => ({
                field: err.path,
                message: err.message
            }));
            
            console.log('❌ Mongoose validation errors:', errors);
            
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: errors.map(e => e.message)
            });
        }

        // Handle duplicate key error (email already exists)
        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            console.log('❌ Duplicate key error:', field, error.keyValue);
            
            return res.status(400).json({
                success: false,
                message: `${field} already exists`
            });
        }

        // Handle cast errors (invalid ObjectId, etc.)
        if (error.name === 'CastError') {
            console.log('❌ Cast error:', error.message);
            return res.status(400).json({
                success: false,
                message: 'Invalid data format'
            });
        }

        // Generic server error
        res.status(500).json({
            success: false,
            message: 'Server error during registration',
            ...(process.env.NODE_ENV === 'development' && { 
                error: error.message,
                stack: error.stack 
            })
        });
    }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
    try {
        console.log('🔑 Login request received:', { email: req.body.email });
        
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        // Check if user exists (include password for comparison)
        const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
        if (!user) {
            console.log('❌ User not found:', email);
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if account is active
        if (!user.isActive) {
            console.log('❌ Account deactivated:', email);
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated'
            });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log('❌ Invalid password for:', email);
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        console.log('✅ User logged in successfully:', user._id);

        // Generate JWT token with user info
        const token = generateToken(user);

        // Remove password from response
        const userResponse = user.toJSON();

        // Set token in httpOnly cookie for browser clients
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        });
        
        // Return plain token in response for API clients (frontend will add Bearer prefix)
        res.json({
            success: true,
            message: 'Login successful',
            token: token,
            user: userResponse
        });
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login',
            ...(process.env.NODE_ENV === 'development' && { 
                error: error.message 
            })
        });
    }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
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
        console.error('❌ Get current user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   POST /api/auth/logout
// @desc    Logout user (optional - mainly for client-side token removal)
// @access  Private
router.post('/logout', auth, async (req, res) => {
    try {
        console.log('👋 User logging out:', req.userId);
        
        // Clear cookie
        res.clearCookie('token');
        
        // In a stateless JWT system, logout is mainly handled client-side
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('❌ Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during logout'
        });
    }
});

module.exports = router;
