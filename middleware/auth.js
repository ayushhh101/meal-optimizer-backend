const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        validate: [validator.isEmail, 'Please provide a valid email']
    },
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [50, 'Name cannot exceed 50 characters']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false // Don't include password in queries by default
    },
    budget: {
        type: Number,
        required: [true, 'Budget is required'],
        min: [0, 'Budget cannot be negative'],
        default: 500
    },
    preferences: {
        dietary: {
            type: [String],
            enum: ['vegetarian', 'vegan', 'non-vegetarian', 'jain', 'gluten-free'],
            default: ['vegetarian']
        },
        cuisines: {
            type: [String],
            default: ['North Indian', 'South Indian']
        },
        allergies: {
            type: [String],
            default: []
        },
        healthGoals: {
            type: [String],
            enum: ['weight-loss', 'weight-gain', 'muscle-building', 'general-health'],
            default: ['general-health']
        },
        maxCalories: {
            type: Number,
            default: 2000
        },
        minProtein: {
            type: Number,
            default: 50
        }
    },
    location: {
        city: {
            type: String,
            required: [true, 'City is required'],
            trim: true
        },
        state: {
            type: String,
            trim: true
        },
        coordinates: {
            lat: Number,
            lng: Number
        }
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true // Automatically adds createdAt and updatedAt
});

// Index for better query performance
userSchema.index({ email: 1 });
userSchema.index({ 'location.city': 1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to get user data without sensitive info
userSchema.methods.toPublicJSON = function() {
    const user = this.toObject();
    delete user.password;
    delete user.__v;
    return user;
};

// JWT authentication middleware
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    // Support token in Authorization header (Bearer) or cookie
    let token = null;
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }
    if (!token) {
        return res.status(401).json({ success: false, message: 'No token, authorization denied' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded._id;
        req.userInfo = {
            name: decoded.name,
            email: decoded.email,
            isActive: decoded.isActive
        };
        next();
    } catch (err) {
        res.status(401).json({ success: false, message: 'Token is not valid' });
    }
};

module.exports = auth;