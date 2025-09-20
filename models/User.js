const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [50, 'Name cannot exceed 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        validate: [validator.isEmail, 'Please provide a valid email']
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
        // Dietary preferences
        dietary: {
            type: [String],
            enum: ['vegetarian', 'vegan', 'non-vegetarian', 'jain', 'gluten-free', 'keto', 'diabetic'],
            default: ['vegetarian']
        },
        // Preferred cuisines
        cuisines: {
            type: [String],
            enum: [
                'North Indian', 'South Indian', 'Chinese', 'Italian', 'Continental',
                'Gujarati', 'Punjabi', 'Bengali', 'Rajasthani', 'Maharashtrian',
                'Tamil', 'Kerala', 'Andhra Pradesh', 'Fast Food', 'Beverages',
                'Sweets', 'Bakery'
            ],
            default: ['North Indian', 'South Indian']
        },
        // Allergies
        allergies: {
            type: [String],
            default: []
        },
        // Health goals
        healthGoals: {
            type: [String],
            enum: ['weight-loss', 'weight-gain', 'muscle-building', 'general-health', 'diabetes-management'],
            default: ['general-health']
        },
        // Nutritional targets
        maxCalories: {
            type: Number,
            default: 2000,
            min: 800,
            max: 4000
        },
        minProtein: {
            type: Number,
            default: 50,
            min: 20,
            max: 200
        },
        maxCarbs: {
            type: Number,
            default: 250
        },
        maxFats: {
            type: Number,
            default: 80
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
        country: {
            type: String,
            default: 'India'
        },
        coordinates: {
            latitude: {
                type: Number,
                min: -90,
                max: 90
            },
            longitude: {
                type: Number,
                min: -180,
                max: 180
            }
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date
    }
}, {
    timestamps: true // Automatically adds createdAt and updatedAt
});

// Create indexes for better performance
userSchema.index({ email: 1 });
userSchema.index({ 'location.city': 1 });
userSchema.index({ 'preferences.dietary': 1 });
userSchema.index({ createdAt: -1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) return next();

    try {
        // Hash password with cost of 12
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

// Instance method to get user data without sensitive info
userSchema.methods.toJSON = function() {
    const user = this.toObject();
    delete user.password;
    delete user.__v;
    return user;
};

// Static method to find user by email
userSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

module.exports = mongoose.model('User', userSchema);