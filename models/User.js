const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters long'],
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: function(email) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
            },
            message: 'Please enter a valid email address'
        }
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false // Don't include password in queries by default
    },
    budget: {
        type: Number,
        default: 75,
        min: [0, 'Budget cannot be negative'],
        max: [10000, 'Budget cannot exceed $10,000']
    },
    location: {
        city: { 
            type: String, 
            default: 'Unknown',
            trim: true
        },
        state: { 
            type: String, 
            default: 'Unknown',
            trim: true
        },
        country: { 
            type: String, 
            default: 'India',
            trim: true
        }
    },
    preferences: {
        cuisines: {
            type: [String],
            default: [],
            enum: [
                // Updated enum values to match your frontend options
                'Mediterranean',
                'Asian', 
                'Mexican',
                'Italian',
                'Indian',         // ✅ Added this
                'Plant-Based',
                'Keto',
                'Paleo', 
                'American',
                'Middle Eastern'
            ],
            validate: {
                validator: function(cuisines) {
                    return Array.isArray(cuisines);
                },
                message: 'Cuisines must be an array'
            }
        },
        goals: {
            type: [String],
            default: [],
            enum: [
                // Updated enum values to match your frontend options
                'Lose Weight',
                'Build Muscle', 
                'Eat More Plants',
                'Save Time',
                'Try New Foods',
                'Eat Healthier',
                'Family Meals',
                'Meal Prep'
            ],
            validate: {
                validator: function(goals) {
                    return Array.isArray(goals);
                },
                message: 'Goals must be an array'
            }
        },
        allergies: {
            type: [String],
            default: [],
            enum: [
                // Updated enum values to match your frontend options
                'Nuts',
                'Dairy',
                'Gluten', 
                'Shellfish',
                'Eggs',
                'Soy',
                'Fish',
                'Sesame',
                'None'
            ],
            validate: {
                validator: function(allergies) {
                    return Array.isArray(allergies);
                },
                message: 'Allergies must be an array'
            }
        },
        dietaryRestrictions: {
            type: [String],
            default: [],
            // No enum restrictions for dietary restrictions - more flexible
            validate: {
                validator: function(restrictions) {
                    return Array.isArray(restrictions);
                },
                message: 'Dietary restrictions must be an array'
            }
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: {
        transform: function(doc, ret) {
            delete ret.password;
            delete ret.__v;
            return ret;
        }
    }
});

// Index for email lookups
userSchema.index({ email: 1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
    try {
        // Only hash the password if it has been modified (or is new)
        if (!this.isModified('password')) return next();
        
        // Hash password with cost of 12
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        if (!this.password) {
            throw new Error('Password not found for user');
        }
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        console.error('Password comparison error:', error);
        throw new Error('Password comparison failed');
    }
};

// Find user by email static method
userSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase().trim() });
};

// Pre-validate middleware
userSchema.pre('validate', function(next) {
    console.log('🔍 Validating user data:', {
        name: this.name,
        email: this.email,
        hasPassword: !!this.password,
        budget: this.budget,
        location: this.location,
        preferences: this.preferences
    });
    next();
});

module.exports = mongoose.model('User', userSchema);
