// backend-service/src/middleware/auth.js
const jwt = require('jsonwebtoken');

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      console.log('❌ No Authorization header');
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required',
        message: 'No authentication token provided' 
      });
    }

    // Extract token (handle both "Bearer token" and just "token")
    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      console.log('❌ No token in Authorization header');
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required',
        message: 'No authentication token provided' 
      });
    }

    console.log('🔑 Token received:', token.substring(0, 20) + '...');

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token decoded:', decoded);

    // IMPORTANT: Use _id from decoded token (matching your generateToken function)
    req.user = { 
      userId: decoded._id,  // Map _id to userId for consistency
      email: decoded.email,
      name: decoded.name
    };
    req.userId = decoded._id; // Also set req.userId for backward compatibility
    
    console.log('✅ Auth successful for user:', req.user.userId);
    
    next();
  } catch (error) {
    console.error('❌ Auth error:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        error: 'Token expired',
        message: 'Your session has expired. Please log in again.' 
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid token',
        message: 'Invalid authentication token. Please log in again.' 
      });
    }
    
    res.status(401).json({ 
      success: false,
      error: 'Authentication failed',
      message: 'Authentication failed. Please log in again.' 
    });
  }
};

module.exports = auth;
