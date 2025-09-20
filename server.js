const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

// Middleware
app.use(helmet());

// Updated CORS configuration
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        console.log('🌐 CORS request from origin:', origin);
        
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            console.log('✅ CORS allowed for:', origin);
            callback(null, true);
        } else {
            console.log('❌ CORS blocked for:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'x-access-token',
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Headers'
    ]
}));

// Body parsing middleware (IMPORTANT: Must be before routes)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Logging middleware
app.use(morgan('combined'));

// Request logging middleware for debugging
app.use((req, res, next) => {
    console.log(`📡 ${new Date().toISOString()} - ${req.method} ${req.path}`);
    if (req.method === 'POST' || req.method === 'PUT') {
        console.log('📦 Request body:', req.body);
    }
    next();
});

// MongoDB Connection
const connectDB = async () => {
    try {
        // Add database name to connection string if not present
        let mongoUri = process.env.MONGODB_URI;
        if (!mongoUri.includes('/meal-optimizer')) {
            mongoUri = `${mongoUri}${mongoUri.endsWith('/') ? '' : '/'}meal-optimizer`;
        }
        
        console.log('🔗 Connecting to MongoDB...');
        const conn = await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📍 Database: ${conn.connection.name}`);
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error.message);
        process.exit(1);
    }
};

// Connect to database
connectDB();

// Handle MongoDB connection events
mongoose.connection.on('connected', () => {
    console.log('🔗 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('🔌 Mongoose disconnected from MongoDB');
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));

// Health check route
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Meal Optimizer Backend is running!',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    });
});

// Welcome route
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to Meal Optimizer API',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                me: 'GET /api/auth/me'
            },
            users: {
                profile: 'GET /api/users/profile',
                updateProfile: 'PUT /api/users/profile',
                updatePreferences: 'PUT /api/users/preferences',
                updateBudget: 'PUT /api/users/budget'
            }
        }
    });
});

// Global error handling middleware
app.use((err, req, res, next) => {
    console.error('🚨 Global Error Handler:', err);
    
    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({
            success: false,
            message: 'Validation Error',
            errors
        });
    }
    
    // Mongoose cast error
    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            message: 'Invalid ID format'
        });
    }
    
    // MongoDB duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(400).json({
            success: false,
            message: `${field} already exists`
        });
    }
    
    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
    
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Token expired'
        });
    }
    
    // CORS errors
    if (err.message.includes('CORS')) {
        return res.status(403).json({
            success: false,
            message: 'CORS error: Origin not allowed'
        });
    }
    
    // Default error
    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// 404 handler
app.use('*', (req, res) => {
    console.log('❌ 404 - Route not found:', req.originalUrl);
    res.status(404).json({ 
        success: false, 
        message: `Route ${req.originalUrl} not found`,
        availableRoutes: [
            'GET /',
            'GET /api/health',
            'POST /api/auth/register',
            'POST /api/auth/login',
            'GET /api/auth/me',
            'POST /api/auth/logout'
        ]
    });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log('🚀 ================================');
    console.log(`🍽️  Meal Optimizer Server Started`);
    console.log(`🌐 Server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Local: http://localhost:${PORT}`);
    console.log(`❤️  Health Check: http://localhost:${PORT}/api/health`);
    console.log('🚀 ================================');
});

// Handle server errors
server.on('error', (error) => {
    if (error.syscall !== 'listen') {
        throw error;
    }

    switch (error.code) {
        case 'EACCES':
            console.error(`❌ Port ${PORT} requires elevated privileges`);
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(`❌ Port ${PORT} is already in use`);
            process.exit(1);
            break;
        default:
            throw error;
    }
});

module.exports = app;
