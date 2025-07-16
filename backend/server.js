// your-health-app-backend/server.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config(); // Load environment variables from .env file

// Import new services
const { runDiseaseScraping, checkLocationAlerts } = require('./disease_scraper');
const { 
    getAuthUrl, 
    getTokensFromCode, 
    fetchGoogleFitData, 
    predictDiseases, 
    getUserPredictions 
} = require('./google_fit_service');
const { scheduleDiseaseScraping, runInitialScraping } = require('./scheduler');
const { 
    registerUser, 
    loginUser, 
    authenticateToken, 
    getUserProfile, 
    updateUserProfile,
    getGoogleFitAuthUrl,
    handleGoogleFitCallback,
    checkGoogleFitConnection,
    refreshGoogleFitToken
} = require('./auth_service');
const { EnhancedPredictionService } = require('./enhanced_prediction_service');

const app = express();
const PORT = process.env.PORT || 3001; // Backend will run on port 3001

// Supabase Configuration
// IMPORTANT: Use your Supabase Project URL and Service Role Key here.
// The Service Role Key should NEVER be exposed in frontend code.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        persistSession: false // No session persistence needed for a server-side client
    }
});

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://yourdomain.com'] 
        : ['http://localhost:3000'],
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add a root route to avoid 'Cannot GET /'
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Welcome to the ProxiHealth API backend!' });
});

// --- API Endpoints ---

// GET /api/health-records: Fetch all health records
app.get('/api/health-records', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('health_records')
            .select('*')
            .order('created_at', { ascending: false }); // Order by timestamp

        if (error) {
            console.error("Supabase fetch error:", error);
            return res.status(500).json({ error: error.message });
        }
        res.status(200).json(data);
    } catch (e) {
        console.error("Server error fetching records:", e);
        res.status(500).json({ error: 'Internal server error while fetching records.' });
    }
});

// --- Authentication Endpoints ---

// POST /api/auth/register: Register a new user
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name, age, gender, weight, height } = req.body;

        // Basic validation
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, password, and name are required.' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
        }

        const result = await registerUser({ email, password, name, age, gender, weight, height });
        res.status(201).json(result);
    } catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({ error: error.message });
    }
});

// POST /api/auth/login: User login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const result = await loginUser(email, password);
        res.status(200).json(result);
    } catch (error) {
        console.error('Login error:', error);
        res.status(401).json({ error: error.message });
    }
});

// GET /api/auth/profile: Get user profile (protected)
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
    try {
        const user = await getUserProfile(req.user.userId);
        res.status(200).json(user);
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(404).json({ error: error.message });
    }
});

// PUT /api/auth/profile: Update user profile (protected)
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
    try {
        const user = await updateUserProfile(req.user.userId, req.body);
        res.status(200).json(user);
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(400).json({ error: error.message });
    }
});

// --- Protected Health Records Endpoints ---

// POST /api/health-records: Store a new health record (protected)
app.post('/api/health-records', authenticateToken, async (req, res) => {
    const { locationData, googleFitData } = req.body;
    const userId = req.user.userId;

    try {
        const { data, error } = await supabase
            .from('health_records')
            .insert([
                {
                    user_id: userId,
                    location_data: locationData,
                    google_fit_data: googleFitData,
                }
            ])
            .select();

        if (error) {
            console.error("Supabase insert error:", error);
            return res.status(500).json({ error: error.message });
        }
        
        // Check for disease outbreaks in user's area
        let nearbyOutbreaks = [];
        if (locationData && locationData.latitude && locationData.longitude) {
            nearbyOutbreaks = await checkLocationAlerts(
                locationData.latitude,
                locationData.longitude
            );
            
            if (nearbyOutbreaks.length > 0) {
                // Store alert
                await supabase
                    .from('user_alerts')
                    .insert({
                        user_id: userId,
                        alert_type: 'disease_outbreak',
                        message: `Health Alert: ${nearbyOutbreaks.length} disease outbreak(s) detected in your area`,
                        outbreak_data: nearbyOutbreaks,
                        created_at: new Date().toISOString()
                    });
            }
        }
        
        res.status(201).json({ 
            message: 'Record created successfully', 
            record: data[0],
            alerts: nearbyOutbreaks
        });
    } catch (e) {
        console.error("Server error storing record:", e);
        res.status(500).json({ error: 'Internal server error while storing record.' });
    }
});

// GET /api/health-records: Fetch user's health records (protected)
app.get('/api/health-records', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('health_records')
            .select('*')
            .eq('user_id', req.user.userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Supabase fetch error:", error);
            return res.status(500).json({ error: error.message });
        }
        res.status(200).json(data);
    } catch (e) {
        console.error("Server error fetching records:", e);
        res.status(500).json({ error: 'Internal server error while fetching records.' });
    }
});

// --- New API Endpoints for Disease Scraping and Google Fit ---

// GET /api/disease-outbreaks: Get current disease outbreaks
app.get('/api/disease-outbreaks', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('disease_outbreaks')
            .select('*')
            .order('last_updated', { ascending: false });

        if (error) {
            console.error("Error fetching outbreaks:", error);
            return res.status(500).json({ error: error.message });
        }
        res.status(200).json(data);
    } catch (e) {
        console.error("Server error fetching outbreaks:", e);
        res.status(500).json({ error: 'Internal server error while fetching outbreaks.' });
    }
});

// POST /api/disease-scraping: Manually trigger disease scraping
app.post('/api/disease-scraping', async (req, res) => {
    try {
        await runDiseaseScraping();
        res.status(200).json({ message: 'Disease scraping completed successfully' });
    } catch (e) {
        console.error("Server error in disease scraping:", e);
        res.status(500).json({ error: 'Internal server error while scraping diseases.' });
    }
});

// GET /api/user-alerts: Get alerts for authenticated user
app.get('/api/user-alerts', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('user_alerts')
            .select('*')
            .eq('user_id', req.user.userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching alerts:", error);
            return res.status(500).json({ error: error.message });
        }
        res.status(200).json(data);
    } catch (e) {
        console.error("Server error fetching alerts:", e);
        res.status(500).json({ error: 'Internal server error while fetching alerts.' });
    }
});

// GET /api/google-fit/auth: Get Google Fit authorization URL (protected)
app.get('/api/google-fit/auth', authenticateToken, (req, res) => {
    try {
        const authUrl = getGoogleFitAuthUrl(req.user.userId);
        res.status(200).json({ authUrl });
    } catch (e) {
        console.error("Server error generating auth URL:", e);
        res.status(500).json({ error: 'Internal server error while generating auth URL.' });
    }
});

// POST /api/google-fit/callback: Handle Google Fit OAuth callback
app.post('/api/google-fit/callback', async (req, res) => {
    const { code, state } = req.body;
    
    if (!code || !state) {
        return res.status(400).json({ error: 'Authorization code and state are required.' });
    }

    try {
        const result = await handleGoogleFitCallback(code, state);
        res.status(200).json(result);
    } catch (e) {
        console.error("Server error in Google Fit callback:", e);
        res.status(500).json({ error: 'Internal server error while processing Google Fit callback.' });
    }
});

// GET /api/google-fit/connection: Check Google Fit connection status (protected)
app.get('/api/google-fit/connection', authenticateToken, async (req, res) => {
    try {
        const connectionStatus = await checkGoogleFitConnection(req.user.userId);
        res.status(200).json(connectionStatus);
    } catch (e) {
        console.error("Server error checking Google Fit connection:", e);
        res.status(500).json({ error: 'Internal server error while checking connection.' });
    }
});

// POST /api/google-fit/sync: Sync Google Fit data for authenticated user
app.post('/api/google-fit/sync', authenticateToken, async (req, res) => {
    try {
        // Check if user has Google Fit connected
        const connectionStatus = await checkGoogleFitConnection(req.user.userId);
        
        if (!connectionStatus.connected) {
            return res.status(400).json({ error: 'Google Fit not connected. Please connect your account first.' });
        }

        // Get user's access token
        const { data: tokenData, error: tokenError } = await supabase
            .from('user_tokens')
            .select('google_fit_access_token')
            .eq('user_id', req.user.userId)
            .single();
            
        if (tokenError || !tokenData) {
            return res.status(400).json({ error: 'Google Fit not connected. Please connect your account first.' });
        }
        
        const fitData = await fetchGoogleFitData(tokenData.google_fit_access_token, req.user.userId);
        res.status(200).json({ message: 'Google Fit data synced successfully', data: fitData });
    } catch (e) {
        console.error("Server error syncing Google Fit data:", e);
        res.status(500).json({ error: 'Internal server error while syncing Google Fit data.' });
    }
});

// POST /api/disease-prediction: Generate disease predictions for authenticated user
app.post('/api/disease-prediction', authenticateToken, async (req, res) => {
    try {
        const predictionService = new EnhancedPredictionService();
        const predictionResult = await predictionService.generatePredictions(req.user.userId);
        
        if (!predictionResult) {
            return res.status(400).json({ error: 'No Google Fit data available for prediction. Please sync your data first.' });
        }
        
        res.status(200).json(predictionResult);
    } catch (e) {
        console.error("Server error in disease prediction:", e);
        res.status(500).json({ error: 'Internal server error while generating predictions.' });
    }
});

// GET /api/disease-prediction: Get existing disease predictions for authenticated user
app.get('/api/disease-prediction', authenticateToken, async (req, res) => {
    try {
        const predictionService = new EnhancedPredictionService();
        const predictions = await predictionService.getUserPredictions(req.user.userId);
        
        if (!predictions) {
            return res.status(404).json({ error: 'No predictions found for this user.' });
        }
        
        res.status(200).json(predictions);
    } catch (e) {
        console.error("Server error fetching predictions:", e);
        res.status(500).json({ error: 'Internal server error while fetching predictions.' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Node.js backend running on http://localhost:${PORT}`);
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("WARNING: Supabase URL or Service Role Key is not set. Please configure your .env file.");
    }
    
    // Start disease scraping scheduler
    runInitialScraping();
    scheduleDiseaseScraping();
});
