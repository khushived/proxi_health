// Authentication Service for ProxiHealth
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
require('dotenv').config();

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

// Google OAuth2 Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
// IMPORTANT: This must match the frontend callback page and Google Cloud Console OAuth redirect URI
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/callback.html';

// Initialize Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
);

// Google Fit API scopes
const SCOPES = [
    'https://www.googleapis.com/auth/fitness.activity.read',
    'https://www.googleapis.com/auth/fitness.heart_rate.read',
    'https://www.googleapis.com/auth/fitness.body.read',
    'https://www.googleapis.com/auth/fitness.location.read',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
];

// User registration
async function registerUser(userData) {
    try {
        const { email, password, name, age, gender, weight, height } = userData;

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email format');
        }

        // Check if user already exists
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('id, email')
            .eq('email', email)
            .single();

        if (existingUser) {
            throw new Error('User with this email already exists');
        }

        // Hash password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create user
        const { data: user, error } = await supabase
            .from('users')
            .insert({
                email,
                password_hash: hashedPassword,
                name,
                age: age ? parseInt(age) : null,
                gender,
                weight: weight ? parseFloat(weight) : null,
                height: height ? parseFloat(height) : null,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating user:', error);
            throw new Error('Failed to create user');
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user.id, 
                email: user.email,
                name: user.name 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Remove password from response
        const { password_hash, ...userWithoutPassword } = user;

        return {
            user: userWithoutPassword,
            token
        };
    } catch (error) {
        console.error('Registration error:', error);
        throw error;
    }
}

// User login
async function loginUser(email, password) {
    try {
        // Find user by email
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) {
            throw new Error('Invalid email or password');
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            throw new Error('Invalid email or password');
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user.id, 
                email: user.email,
                name: user.name 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Remove password from response
        const { password_hash, ...userWithoutPassword } = user;

        return {
            user: userWithoutPassword,
            token
        };
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

// Verify JWT token
function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
}

// Get Google Fit authorization URL
function getGoogleFitAuthUrl(userId) {
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
    
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
        state: state
    });
}

// Handle Google Fit OAuth callback
async function handleGoogleFitCallback(code, state) {
    try {
        // Decode state to get userId
        const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
        const { userId } = decodedState;

        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        
        // Get user info from Google
        oauth2Client.setCredentials(tokens);
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();

        // Verify email matches user's email
        const { data: user, error } = await supabase
            .from('users')
            .select('email')
            .eq('id', userId)
            .single();

        if (error || !user) {
            throw new Error('User not found');
        }

        if (user.email !== userInfo.data.email) {
            throw new Error('Email mismatch. Please use the same email for Google Fit.');
        }

        // Store tokens securely
        const { error: tokenError } = await supabase
            .from('user_tokens')
            .upsert({
                user_id: userId,
                google_fit_access_token: tokens.access_token,
                google_fit_refresh_token: tokens.refresh_token,
                expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
                google_email: userInfo.data.email,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            });

        if (tokenError) {
            console.error('Error storing tokens:', tokenError);
            throw new Error('Failed to store Google Fit tokens');
        }

        return {
            success: true,
            message: 'Google Fit connected successfully',
            googleEmail: userInfo.data.email
        };
    } catch (error) {
        console.error('Google Fit callback error:', error);
        throw error;
    }
}

// Get user profile
async function getUserProfile(userId) {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, name, age, gender, weight, height, created_at, updated_at')
            .eq('id', userId)
            .single();

        if (error || !user) {
            throw new Error('User not found');
        }

        return user;
    } catch (error) {
        console.error('Get user profile error:', error);
        throw error;
    }
}

// Update user profile
async function updateUserProfile(userId, updateData) {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .update({
                ...updateData,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)
            .select('id, email, name, age, gender, weight, height, created_at, updated_at')
            .single();

        if (error || !user) {
            throw new Error('Failed to update user profile');
        }

        return user;
    } catch (error) {
        console.error('Update user profile error:', error);
        throw error;
    }
}

// Check if user has Google Fit connected
async function checkGoogleFitConnection(userId) {
    try {
        const { data: tokenData, error } = await supabase
            .from('user_tokens')
            .select('google_fit_access_token, expires_at, google_email')
            .eq('user_id', userId)
            .single();

        if (error || !tokenData) {
            return { connected: false };
        }

        // Check if token is expired
        const isExpired = tokenData.expires_at && new Date(tokenData.expires_at) < new Date();

        return {
            connected: !isExpired,
            googleEmail: tokenData.google_email,
            tokenExpired: isExpired
        };
    } catch (error) {
        console.error('Check Google Fit connection error:', error);
        return { connected: false };
    }
}

// Middleware to authenticate requests
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = verifyToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
}

// Refresh Google Fit token
async function refreshGoogleFitToken(userId) {
    try {
        const { data: tokenData, error } = await supabase
            .from('user_tokens')
            .select('google_fit_refresh_token')
            .eq('user_id', userId)
            .single();

        if (error || !tokenData || !tokenData.google_fit_refresh_token) {
            throw new Error('No refresh token available');
        }

        oauth2Client.setCredentials({
            refresh_token: tokenData.google_fit_refresh_token
        });

        const { credentials } = await oauth2Client.refreshAccessToken();

        // Update tokens in database
        await supabase
            .from('user_tokens')
            .update({
                google_fit_access_token: credentials.access_token,
                expires_at: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

        return credentials.access_token;
    } catch (error) {
        console.error('Refresh token error:', error);
        throw error;
    }
}

module.exports = {
    registerUser,
    loginUser,
    verifyToken,
    getGoogleFitAuthUrl,
    handleGoogleFitCallback,
    getUserProfile,
    updateUserProfile,
    checkGoogleFitConnection,
    authenticateToken,
    refreshGoogleFitToken
}; 