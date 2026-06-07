// Authentication Service for ProxiHealth
const { createClient } = require('./supabase_wrapper');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const localDb = require('./local_db');
require('dotenv').config();

class AuthServiceError extends Error {
    constructor(message, statusCode = 500, code = 'AUTH_ERROR') {
        super(message);
        this.name = 'AuthServiceError';
        this.statusCode = statusCode;
        this.code = code;
    }
}

function isNetworkFetchFailure(error) {
    if (!error) return false;
    const message = (error.message ? String(error.message) : '').toLowerCase();
    const details = (error.details ? String(error.details) : '').toLowerCase();
    return message.includes('fetch failed') || details.includes('fetch failed') || message.includes('failed to fetch') || details.includes('enotfound');
}

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
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/callback.html';

// Initialize Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
);

function normalizeUserRole(role) {
    return role === 'doctor' ? 'doctor' : 'patient';
}

function pickProfileFields(source = {}) {
    const allowedFields = ['name', 'age', 'gender', 'weight', 'height', 'smoker', 'alcohol_consumption', 'alcoholConsumption'];
    return allowedFields.reduce((result, field) => {
        if (source[field] !== undefined) {
            if (field === 'alcoholConsumption') {
                result['alcohol_consumption'] = source[field];
            } else {
                result[field] = source[field];
            }
        }
        return result;
    }, {});
}

function pickDoctorProfileFields(source = {}) {
    const allowedFields = ['specialty', 'license_number', 'clinic_name', 'consultation_mode', 'bio', 'years_of_experience', 'verification_status'];
    return allowedFields.reduce((result, field) => {
        if (source[field] !== undefined) {
            result[field] = source[field];
        }
        return result;
    }, {});
}

// Google Fit API scopes
const SCOPES = [
    // Google Cloud Healthcare (FHIR) scopes for health data
    'https://www.googleapis.com/auth/cloud-healthcare',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
];

// User registration
async function registerUser(userData) {
    try {
        const { email, password, name, age, gender, weight, height, role, specialty, licenseNumber, clinicName, consultationMode, bio, yearsOfExperience, doctorCode, smoker, alcoholConsumption } = userData;
        const userRole = normalizeUserRole(role);

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email format');
        }

        if (userRole === 'doctor' && process.env.DOCTOR_REGISTRATION_CODE && doctorCode !== process.env.DOCTOR_REGISTRATION_CODE) {
            throw new AuthServiceError('Invalid doctor registration code', 403, 'INVALID_DOCTOR_CODE');
        }

        // Check if user already exists
        let existingUser = null;
        let checkError = null;
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, email')
                .eq('email', email)
                .single();
            existingUser = data;
            checkError = error;
        } catch (e) {
            checkError = e;
        }

        if (checkError && isNetworkFetchFailure(checkError)) {
            existingUser = localDb.findSingle('users', (u) => u.email === email);
            checkError = null;
        }

        if (existingUser) {
            throw new AuthServiceError('User with this email already exists', 409, 'USER_EXISTS');
        }

        // Hash password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create user
        let user = null;
        let error = null;
        try {
            const { data, error: err } = await supabase
                .from('users')
                .insert({
                    email,
                    password_hash: hashedPassword,
                    name,
                    role: userRole,
                    age: age ? parseInt(age) : null,
                    gender,
                    weight: weight ? parseFloat(weight) : null,
                    height: height ? parseFloat(height) : null,
                    smoker: smoker || null,
                    alcohol_consumption: alcoholConsumption || null,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();
            user = data;
            error = err;
        } catch (e) {
            error = e;
        }

        if (error && isNetworkFetchFailure(error)) {
            user = localDb.insert('users', {
                email,
                password_hash: hashedPassword,
                name,
                role: userRole,
                age: age ? parseInt(age) : null,
                gender,
                weight: weight ? parseFloat(weight) : null,
                height: height ? parseFloat(height) : null,
                smoker: smoker || null,
                alcohol_consumption: alcoholConsumption || null
            });
            error = null;
        }

        if (error) {
            console.error('Error creating user:', error);
            throw new AuthServiceError('Failed to create user', 400, 'REGISTER_FAILED');
        }

        if (userRole === 'doctor') {
            let doctorProfileError = null;
            try {
                const { error: err } = await supabase
                    .from('doctor_profiles')
                    .upsert({
                        user_id: user.id,
                        specialty: specialty || null,
                        license_number: licenseNumber || null,
                        clinic_name: clinicName || null,
                        consultation_mode: consultationMode || 'hybrid',
                        bio: bio || null,
                        years_of_experience: yearsOfExperience ? parseInt(yearsOfExperience) : 0,
                        verification_status: 'pending',
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_id' });
                doctorProfileError = err;
            } catch (e) {
                doctorProfileError = e;
            }

            if (doctorProfileError && isNetworkFetchFailure(doctorProfileError)) {
                localDb.upsert('doctor_profiles', {
                    user_id: user.id,
                    specialty: specialty || null,
                    license_number: licenseNumber || null,
                    clinic_name: clinicName || null,
                    consultation_mode: consultationMode || 'hybrid',
                    bio: bio || null,
                    years_of_experience: yearsOfExperience ? parseInt(yearsOfExperience) : 0,
                    verification_status: 'verified' // Auto verify locally for convenience
                }, ['user_id']);
                doctorProfileError = null;
            }

            if (doctorProfileError) {
                console.error('Error creating doctor profile:', doctorProfileError);
                throw new AuthServiceError('Failed to create doctor profile', 400, 'DOCTOR_PROFILE_FAILED');
            }
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user.id, 
                email: user.email,
                name: user.name,
                role: userRole
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Remove password from response
        const { password_hash, ...userWithoutPassword } = user;

        let doctorProfile = null;
        if (userRole === 'doctor') {
            let profileError = null;
            try {
                const { data, error: err } = await supabase
                    .from('doctor_profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .maybeSingle();
                doctorProfile = data;
                profileError = err;
            } catch (e) {
                profileError = e;
            }

            if (profileError && isNetworkFetchFailure(profileError)) {
                doctorProfile = localDb.findSingle('doctor_profiles', (p) => p.user_id === user.id);
                profileError = null;
            }
        }

        return {
            user: {
                ...userWithoutPassword,
                doctorProfile
            },
            token
        };
    } catch (error) {
        console.error('Registration error:', error);
        if (error instanceof AuthServiceError) {
            throw error;
        }
        throw new AuthServiceError(error.message || 'Registration failed', 400, 'REGISTER_FAILED');
    }
}

// User login
async function loginUser(email, password) {
    try {
        let user = null;
        let error = null;
        try {
            const { data, error: err } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .single();
            user = data;
            error = err;
        } catch (e) {
            error = e;
        }

        if (error && isNetworkFetchFailure(error)) {
            user = localDb.findSingle('users', (u) => u.email === email);
            error = null;
        }

        if (error || !user) {
            throw new AuthServiceError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            throw new AuthServiceError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user.id, 
                email: user.email,
                name: user.name,
                role: normalizeUserRole(user.role)
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Remove password from response
        const { password_hash, ...userWithoutPassword } = user;

        let doctorProfile = null;
        if (userWithoutPassword.role === 'doctor') {
            let profileError = null;
            try {
                const { data, error: err } = await supabase
                    .from('doctor_profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .maybeSingle();
                doctorProfile = data;
                profileError = err;
            } catch (e) {
                profileError = e;
            }

            if (profileError && isNetworkFetchFailure(profileError)) {
                doctorProfile = localDb.findSingle('doctor_profiles', (p) => p.user_id === user.id);
                profileError = null;
            }
        }

        return {
            user: {
                ...userWithoutPassword,
                doctorProfile
            },
            token
        };
    } catch (error) {
        console.error('Login error:', error);
        if (error instanceof AuthServiceError) {
            throw error;
        }
        throw new AuthServiceError(error.message || 'Login failed', 401, 'LOGIN_FAILED');
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
// Google Health OAuth URL generation (new)
function getGoogleHealthAuthUrl(userId) {
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
        state: state
    });
}

// Handle Google Fit OAuth callback
// Google Health callback handling (new)
async function handleGoogleHealthCallback(code, state) {
    const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
    const { userId } = decodedState;

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    // Verify user email matches
    const { data: user, error: userErr } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();
    if (userErr) throw userErr;
    if (user.email !== userInfo.data.email) {
        throw new Error('Email mismatch. Please use the same email for Google Health.');
    }

    // Store Google Health tokens
    const { error: tokenErr } = await supabase
        .from('user_tokens')
        .upsert({
            user_id: userId,
            google_health_access_token: tokens.access_token,
            google_health_refresh_token: tokens.refresh_token,
            expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
            google_email: userInfo.data.email,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
    if (tokenErr) throw tokenErr;

    return { success: true, message: 'Google Health connected', userEmail: user.email };
}
// Compatibility aliases for legacy Google Fit routes
const getGoogleFitAuthUrl = getGoogleHealthAuthUrl;
const handleGoogleFitCallback = handleGoogleHealthCallback;

// Get user profile
async function getUserProfile(userId) {
    try {
        let user = null;
        let error = null;
        try {
            const { data, error: err } = await supabase
                .from('users')
                .select('id, email, name, role, age, gender, weight, height, smoker, alcohol_consumption, created_at, updated_at')
                .eq('id', userId)
                .single();
            user = data;
            error = err;
        } catch (e) {
            error = e;
        }

        if (error && isNetworkFetchFailure(error)) {
            user = localDb.findSingle('users', (u) => u.id === userId);
            error = null;
        }

        if (error || !user) {
            throw new Error('User not found');
        }

        let doctorProfile = null;
        if (user.role === 'doctor') {
            let profileError = null;
            try {
                const { data, error: err } = await supabase
                    .from('doctor_profiles')
                    .select('*')
                    .eq('user_id', userId)
                    .maybeSingle();
                doctorProfile = data;
                profileError = err;
            } catch (e) {
                profileError = e;
            }

            if (profileError && isNetworkFetchFailure(profileError)) {
                doctorProfile = localDb.findSingle('doctor_profiles', (p) => p.user_id === userId);
                profileError = null;
            }
        }

        return {
            ...user,
            doctorProfile
        };
    } catch (error) {
        console.error('Get user profile error:', error);
        throw error;
    }
}

// Update user profile
async function updateUserProfile(userId, updateData) {
    try {
        const userUpdates = pickProfileFields(updateData);
        const doctorProfileUpdates = pickDoctorProfileFields(updateData.doctorProfile || {});

        let user = null;
        let error = null;
        try {
            const { data, error: err } = await supabase
                .from('users')
                .update({
                    ...userUpdates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId)
                .select('id, email, name, role, age, gender, weight, height, created_at, updated_at')
                .single();
            user = data;
            error = err;
        } catch (e) {
            error = e;
        }

        if (error && isNetworkFetchFailure(error)) {
            user = localDb.upsert('users', {
                id: userId,
                ...userUpdates
            }, ['id']);
            error = null;
        }

        if (error || !user) {
            throw new Error('Failed to update user profile');
        }

        if (user.role === 'doctor' && Object.keys(doctorProfileUpdates).length > 0) {
            let doctorError = null;
            try {
                const { error: err } = await supabase
                    .from('doctor_profiles')
                    .upsert({
                        user_id: userId,
                        ...doctorProfileUpdates,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_id' });
                doctorError = err;
            } catch (e) {
                doctorError = e;
            }

            if (doctorError && isNetworkFetchFailure(doctorError)) {
                localDb.upsert('doctor_profiles', {
                    user_id: userId,
                    ...doctorProfileUpdates
                }, ['user_id']);
                doctorError = null;
            }

            if (doctorError) {
                throw new Error('Failed to update doctor profile');
            }
        }

        return getUserProfile(userId);
    } catch (error) {
        console.error('Update user profile error:', error);
        throw error;
    }
}

// Check if user has Google Fit connected
async function checkGoogleFitConnection(userId) {
    try {
        let tokenData = null;
        let error = null;
        try {
            const { data, error: err } = await supabase
                .from('user_tokens')
                .select('google_fit_access_token, google_fit_refresh_token, expires_at, google_email')
                .eq('user_id', userId)
                .single();
            tokenData = data;
            error = err;
        } catch (e) {
            error = e;
        }

        if (error && isNetworkFetchFailure(error)) {
            tokenData = localDb.findSingle('user_tokens', (t) => t.user_id === userId);
            error = null;
        }

        if (error || !tokenData) {
            return { connected: false };
        }

        // Check if token is expired
        const isExpired = tokenData.expires_at && new Date(tokenData.expires_at) < new Date();

        if (isExpired) {
            // Detect mock tokens by their refresh token prefix (set during mock-connect)
            const isMock = tokenData.google_fit_refresh_token && tokenData.google_fit_refresh_token.startsWith('mock-refresh-token-');
            
            if (isMock) {
                // Self-heal mock connection by renewing locally
                const newExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
                try {
                    await supabase
                        .from('user_tokens')
                        .update({
                            expires_at: newExpiresAt,
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', userId);
                } catch (dbErr) {
                    console.error('Failed to update mock token expiration in DB:', dbErr);
                }
                
                // Fallback local update if network failed
                localDb.upsert('user_tokens', {
                    user_id: userId,
                    expires_at: newExpiresAt
                }, ['user_id']);

                return {
                    connected: true,
                    googleEmail: tokenData.google_email,
                    tokenExpired: false
                };
            } else if (tokenData.google_fit_refresh_token) {
                // Self-heal real connection by auto-refreshing token
                try {
                    console.log(`Google Fit token expired for user ${userId}. Attempting self-healing refresh...`);
                    await refreshGoogleFitToken(userId);
                    return {
                        connected: true,
                        googleEmail: tokenData.google_email,
                        tokenExpired: false
                    };
                } catch (refreshErr) {
                    console.error(`Self-healing token refresh failed for user ${userId}:`, refreshErr);
                    return {
                        connected: false,
                        googleEmail: tokenData.google_email,
                        tokenExpired: true,
                        error: 'Google Fit session expired. Please reconnect.'
                    };
                }
            }
        }

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
        let tokenData = null;
        let error = null;
        try {
            const { data, error: err } = await supabase
                .from('user_tokens')
                .select('google_fit_refresh_token')
                .eq('user_id', userId)
                .single();
            tokenData = data;
            error = err;
        } catch (e) {
            error = e;
        }

        if (error && isNetworkFetchFailure(error)) {
            tokenData = localDb.findSingle('user_tokens', (t) => t.user_id === userId);
            error = null;
        }

        if (error || !tokenData || !tokenData.google_fit_refresh_token) {
            throw new Error('No refresh token available');
        }

        oauth2Client.setCredentials({
            refresh_token: tokenData.google_fit_refresh_token
        });

        const { credentials } = await oauth2Client.refreshAccessToken();

        // Update tokens in database
        let updateError = null;
        try {
            const { error: err } = await supabase
                .from('user_tokens')
                .update({
                    google_fit_access_token: credentials.access_token,
                    expires_at: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId);
            updateError = err;
        } catch (e) {
            updateError = e;
        }

        if (updateError && isNetworkFetchFailure(updateError)) {
            localDb.upsert('user_tokens', {
                user_id: userId,
                google_fit_access_token: credentials.access_token,
                expires_at: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null
            }, ['user_id']);
            updateError = null;
        }

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