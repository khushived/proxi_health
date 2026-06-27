// your-health-app-backend/server.js
const express = require('express');
const { createClient } = require('./supabase_wrapper');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config(); // Load environment variables from .env file

// Import new services
const { runDiseaseScraping, checkLocationAlerts, buildOutbreakAlertMessage, alertAlreadyExists } = require('./disease_scraper');

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
const { FutureDiseaseRiskService } = require('./future_disease_risk_service');

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

function normalizePredictionPayload(payload) {
    if (!payload) return null;

    return {
        predictions: payload.predictions || {},
        healthMetrics: payload.healthMetrics || payload.health_metrics || {},
        recommendations: payload.recommendations || [],
        overallHealthScore: payload.overallHealthScore ?? payload.overall_health_score ?? null,
        riskSegment: payload.riskSegment || payload.risk_segment || null,
        expertMonitoring: payload.expertMonitoring || payload.expert_monitoring || null,
        lastUpdated: payload.lastUpdated || payload.updated_at || payload.created_at || null
    };
}

function requireRoles(...allowedRoles) {
    return (req, res, next) => {
        const userRole = req.user?.role || 'patient';
        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({ error: 'You do not have permission to access this resource.' });
        }
        next();
    };
}

function normalizeDoctorAssignment(summary) {
    return {
        patient: summary.patient,
        healthData: summary.healthData || null,
        healthRecords: summary.healthRecords || [],
        alerts: summary.alerts || [],
        prescriptions: summary.prescriptions || [],
        diseasePredictions: normalizePredictionPayload(summary.diseasePredictions),
        futureRisk: summary.futureRisk || null,
        latestRecord: summary.healthRecords?.[0] || null
    };
}

async function loadPatientClinicalSummary(patientId) {
    const [patientResponse, recordsResponse, alertsResponse, predictionsResponse, prescriptionsResponse, futureRiskResponse, healthDataResponse] = await Promise.all([
        supabase
            .from('users')
            .select('id, email, name, role, age, gender, weight, height, smoker, alcohol_consumption, created_at, updated_at')
            .eq('id', patientId)
            .single(),
        supabase
            .from('health_records')
            .select('*')
            .eq('user_id', patientId)
            .order('created_at', { ascending: false }),
        supabase
            .from('user_alerts')
            .select('*')
            .eq('user_id', patientId)
            .order('created_at', { ascending: false }),
        supabase
            .from('disease_predictions')
            .select('*')
            .eq('user_id', patientId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabase
            .from('prescriptions')
            .select('*')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false }),
        futureRiskService.generateFutureRisk(patientId).catch((error) => {
            console.error('Error generating patient future risk summary:', error);
            return null;
        }),
        supabase
            .from('user_health_data')
            .select('*')
            .eq('user_id', patientId)
            .maybeSingle()
    ]);

    if (patientResponse.error || !patientResponse.data) {
        throw new Error('Patient not found');
    }

    return {
        patient: patientResponse.data,
        healthData: healthDataResponse.data || null,
        healthRecords: recordsResponse.data || [],
        alerts: alertsResponse.data || [],
        diseasePredictions: predictionsResponse.data || null,
        prescriptions: prescriptionsResponse.data || [],
        futureRisk: futureRiskResponse || null
    };
}

async function isDoctorAssignedToPatient(doctorId, patientId) {
    const { data, error } = await supabase
        .from('patient_doctor_assignments')
        .select('id')
        .eq('doctor_id', doctorId)
        .eq('patient_id', patientId)
        .maybeSingle();

    if (error) {
        console.error('Error checking doctor assignment:', error);
        return false;
    }

    return Boolean(data);
}

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
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

const futureRiskService = new FutureDiseaseRiskService();

// GET /api/health-records/all: doctor-only endpoint for all records
app.get('/api/health-records/all', authenticateToken, requireRoles('doctor'), async (req, res) => {
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
        const { email, password, name, age, gender, weight, height, role, specialty, licenseNumber, clinicName, consultationMode, bio, yearsOfExperience, doctorCode } = req.body;

        // Basic validation
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, password, and name are required.' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
        }

        const result = await registerUser({ email, password, name, age, gender, weight, height, role, specialty, licenseNumber, clinicName, consultationMode, bio, yearsOfExperience, doctorCode });
        res.status(201).json(result);
    } catch (error) {
        console.error('Registration error:', error);
        res.status(error.statusCode || 400).json({ error: error.message, code: error.code || 'REGISTER_FAILED' });
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
        res.status(error.statusCode || 401).json({ error: error.message, code: error.code || 'LOGIN_FAILED' });
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
                const alertMessage = buildOutbreakAlertMessage(nearbyOutbreaks);
                const alreadyExists = await alertAlreadyExists(userId, alertMessage, nearbyOutbreaks);

                if (!alreadyExists) {
                    const alertPayload = {
                        outbreaks: nearbyOutbreaks,
                        summary: alertMessage,
                        generated_at: new Date().toISOString()
                    };

                    // Store alert
                    await supabase
                        .from('user_alerts')
                        .insert({
                            user_id: userId,
                            alert_type: 'disease_outbreak',
                            message: alertMessage,
                            outbreak_data: alertPayload,
                            created_at: new Date().toISOString()
                        });
                }
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

// POST /api/disease-scraping: Manually trigger disease scraping for trusted users
app.post('/api/disease-scraping', authenticateToken, requireRoles('doctor'), async (req, res) => {
    try {
        await runDiseaseScraping();
        res.status(200).json({ message: 'Disease scraping completed successfully' });
    } catch (e) {
        console.error("Server error in disease scraping:", e);
        res.status(500).json({ error: 'Internal server error while scraping diseases.' });
    }
});

// GET /api/user-alerts: Get alerts for authenticated user (deduplicated by message)
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

        // Deduplicate by message text — keep only the latest alert per unique message
        const seenMessages = new Set();
        const uniqueAlerts = [];
        for (const alert of (data || [])) {
            if (alert.message && !seenMessages.has(alert.message)) {
                seenMessages.add(alert.message);
                uniqueAlerts.push(alert);
            }
        }

        res.status(200).json(uniqueAlerts);
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

// NOTE: Google Fit REST API is deprecated as of 2025.
// Mock connect endpoint kept for backward compatibility — returns deprecation info.
app.post('/api/google-fit/mock-connect', authenticateToken, async (req, res) => {
    res.status(410).json({
        error: 'Google Fit API has been deprecated. Please use the manual health data entry instead.',
        action: 'use_health_data_form'
    });
});

// GET /api/health-data/status: Returns health assessment status
app.get('/api/health-data/status', authenticateToken, async (req, res) => {
    try {
        const { data: healthData, error } = await supabase
            .from('user_health_data')
            .select('updated_at')
            .eq('user_id', req.user.userId)
            .maybeSingle();

        const hasHealthData = !error && healthData !== null;
        res.status(200).json({
            connected: hasHealthData,
            dataSource: 'manual_entry',
            lastUpdated: healthData?.updated_at || null,
            message: hasHealthData
                ? 'Health data entered manually.'
                : 'No health data found. Please complete the health data form.'
        });
    } catch (e) {
        console.error('Server error checking health data status:', e);
        res.status(200).json({ connected: false, dataSource: 'manual_entry' });
    }
});

// GET /api/google-fit/connection: Returns health data status (Google Fit API is deprecated)
app.get('/api/google-fit/connection', authenticateToken, async (req, res) => {
    try {
        // Check if user has manually entered health data (replaces Google Fit)
        const { data: healthData, error } = await supabase
            .from('user_health_data')
            .select('updated_at')
            .eq('user_id', req.user.userId)
            .maybeSingle();

        const hasHealthData = !error && healthData !== null;
        res.status(200).json({
            connected: hasHealthData,
            dataSource: 'manual_entry',
            lastUpdated: healthData?.updated_at || null,
            deprecated: true,
            message: hasHealthData
                ? 'Health data entered manually.'
                : 'No health data found. Please complete the health data form.'
        });
    } catch (e) {
        console.error('Server error checking health data status:', e);
        res.status(200).json({ connected: false, dataSource: 'manual_entry' });
    }
});

// GET /api/health-data: Fetch authenticated user's manually entered health data
app.get('/api/health-data', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('user_health_data')
            .select('*')
            .eq('user_id', req.user.userId)
            .maybeSingle();

        if (error) {
            console.error('Error fetching health data:', error);
            return res.status(500).json({ error: error.message });
        }
        res.status(200).json(data || null);
    } catch (e) {
        console.error('Server error fetching health data:', e);
        res.status(500).json({ error: 'Internal server error fetching health data.' });
    }
});

// POST /api/health-data: Save/update manually entered health metrics
app.post('/api/health-data', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const {
            dailySteps, restingHeartRate, sleepHours, deepSleepHours,
            stressLevel, physicalActivityLevel, weeklyExerciseHours,
            chronicConditions, familyHistory, currentSymptoms,
            dietQuality, waterIntakeLiters, bloodOxygenLevel,
            lastCheckupMonths, onMedication, medicationDetails,
            snoring, wakeupsPerNight, mood
        } = req.body;

        // Validate required fields
        if (dailySteps === undefined || restingHeartRate === undefined) {
            return res.status(400).json({ error: 'Daily steps and resting heart rate are required.' });
        }

        const healthPayload = {
            user_id: userId,
            daily_steps: parseInt(dailySteps) || 0,
            resting_heart_rate: parseInt(restingHeartRate) || 72,
            sleep_hours: parseFloat(sleepHours) || 7.0,
            deep_sleep_hours: parseFloat(deepSleepHours) || 1.5,
            stress_level: stressLevel || 'medium',
            physical_activity_level: physicalActivityLevel || 'lightly_active',
            weekly_exercise_hours: parseFloat(weeklyExerciseHours) || 0,
            chronic_conditions: chronicConditions || [],
            family_history: familyHistory || [],
            current_symptoms: currentSymptoms || [],
            diet_quality: dietQuality || 'fair',
            water_intake_liters: parseFloat(waterIntakeLiters) || 2.0,
            blood_oxygen_level: parseFloat(bloodOxygenLevel) || 98.0,
            last_checkup_months: parseInt(lastCheckupMonths) || 12,
            on_medication: onMedication === true || onMedication === 'true',
            medication_details: medicationDetails || null,
            snoring: snoring === true || snoring === 'true',
            wakeups_per_night: parseInt(wakeupsPerNight) || 1,
            mood: mood || 'neutral',
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('user_health_data')
            .upsert(healthPayload, { onConflict: 'user_id' })
            .select()
            .single();

        if (error) {
            console.error('Error saving health data:', error);
            return res.status(500).json({ error: error.message });
        }

        res.status(200).json({
            success: true,
            message: 'Health data saved successfully.',
            data
        });
    } catch (e) {
        console.error('Server error saving health data:', e);
        res.status(500).json({ error: 'Internal server error saving health data.' });
    }
});

// GET /api/future-disease-risk: Project disease risks 10 years into the future
app.get('/api/future-disease-risk', authenticateToken, async (req, res) => {
    try {
        const futureRisk = await futureRiskService.generateFutureRisk(req.user.userId);
        const futurePredictions = futureRisk.predictions || [];
        const futurePredictionMap = futurePredictions.reduce((result, item) => {
            result[item.key] = item;
            return result;
        }, {});

        res.status(200).json({
            predictions: futurePredictionMap,
            futurePredictions,
            healthMetrics: futureRisk.healthMetrics,
            recommendations: futureRisk.recommendations,
            overallHealthScore: futureRisk.overallHealthScore,
            riskSegment: futureRisk.riskSegment,
            expertMonitoring: futureRisk.expertMonitoring,
            lastUpdated: futureRisk.lastUpdated
        });
    } catch (e) {
        console.error('Server error generating future risk:', e);
        if (e.message && e.message.includes('User not found')) {
            return res.status(404).json({ error: e.message });
        }
        res.status(500).json({ error: e.message || 'Internal server error while generating future disease risk.' });
    }
});

// POST /api/google-fit/sync: Deprecated — Google Fit REST API is shut down
app.post('/api/google-fit/sync', authenticateToken, async (req, res) => {
    res.status(410).json({
        error: 'Google Fit API has been deprecated. Please use the manual health data entry instead.',
        action: 'use_health_data_form'
    });
});

// GET /api/doctor/patients: list patients assigned to the authenticated doctor
app.get('/api/doctor/patients', authenticateToken, requireRoles('doctor'), async (req, res) => {
    try {
        const { data: assignments, error } = await supabase
            .from('patient_doctor_assignments')
            .select('patient_id, notes, created_at, updated_at')
            .eq('doctor_id', req.user.userId)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        const summaries = [];
        for (const assignment of assignments || []) {
            try {
                const clinicalSummary = await loadPatientClinicalSummary(assignment.patient_id);
                summaries.push({
                    ...normalizeDoctorAssignment(clinicalSummary),
                    assignment
                });
            } catch (summaryError) {
                console.error('Error loading patient summary:', summaryError);
            }
        }

        res.status(200).json(summaries);
    } catch (e) {
        console.error('Server error fetching doctor patients:', e);
        res.status(500).json({ error: 'Internal server error while fetching doctor patients.' });
    }
});

// POST /api/doctor/patients/:patientId/assign: assign a patient to the authenticated doctor
app.post('/api/doctor/patients/:patientId/assign', authenticateToken, requireRoles('doctor'), async (req, res) => {
    try {
        const patientId = req.params.patientId;
        const { notes } = req.body || {};

        const { data: patient, error: patientError } = await supabase
            .from('users')
            .select('id, role, name, email')
            .eq('id', patientId)
            .maybeSingle();

        if (patientError || !patient) {
            return res.status(404).json({ error: 'Patient not found.' });
        }

        if (patient.role !== 'patient') {
            return res.status(400).json({ error: 'Only patient accounts can be assigned.' });
        }

        const { error: assignmentError } = await supabase
            .from('patient_doctor_assignments')
            .upsert({
                doctor_id: req.user.userId,
                patient_id: patientId,
                assigned_by: req.user.userId,
                notes: notes || null,
                updated_at: new Date().toISOString()
            }, { onConflict: 'doctor_id,patient_id' });

        if (assignmentError) {
            return res.status(500).json({ error: assignmentError.message });
        }

        res.status(200).json({ message: 'Patient assigned successfully', patient });
    } catch (e) {
        console.error('Server error assigning patient:', e);
        res.status(500).json({ error: 'Internal server error while assigning patient.' });
    }
});

// GET /api/doctor/patients/:patientId: fetch one patient summary for an assigned doctor
app.get('/api/doctor/patients/:patientId', authenticateToken, requireRoles('doctor'), async (req, res) => {
    try {
        const patientId = req.params.patientId;
        const assigned = await isDoctorAssignedToPatient(req.user.userId, patientId);

        if (!assigned) {
            return res.status(403).json({ error: 'This patient is not assigned to you.' });
        }

        const summary = await loadPatientClinicalSummary(patientId);
        res.status(200).json(normalizeDoctorAssignment(summary));
    } catch (e) {
        console.error('Server error fetching patient summary:', e);
        res.status(500).json({ error: 'Internal server error while fetching patient summary.' });
    }
});

// POST /api/doctor/patients/:patientId/prescriptions: create a prescription for an assigned patient
app.post('/api/doctor/patients/:patientId/prescriptions', authenticateToken, requireRoles('doctor'), async (req, res) => {
    try {
        const patientId = req.params.patientId;
        const assigned = await isDoctorAssignedToPatient(req.user.userId, patientId);

        if (!assigned) {
            return res.status(403).json({ error: 'This patient is not assigned to you.' });
        }

        const { medicineName, dosage, frequency, durationDays, instructions, prescribedFor, startDate, endDate } = req.body || {};

        if (!medicineName) {
            return res.status(400).json({ error: 'medicineName is required.' });
        }

        const { data, error } = await supabase
            .from('prescriptions')
            .insert({
                patient_id: patientId,
                doctor_id: req.user.userId,
                medicine_name: medicineName,
                dosage: dosage || null,
                frequency: frequency || null,
                duration_days: durationDays ? parseInt(durationDays, 10) : null,
                instructions: instructions || null,
                prescribed_for: prescribedFor || null,
                start_date: startDate || null,
                end_date: endDate || null,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.status(201).json(data);
    } catch (e) {
        console.error('Server error creating prescription:', e);
        res.status(500).json({ error: 'Internal server error while creating prescription.' });
    }
});

// GET /api/prescriptions: current user prescriptions or doctor-issued medicines
app.get('/api/prescriptions', authenticateToken, async (req, res) => {
    try {
        const userRole = req.user.role || 'patient';
        const query = supabase.from('prescriptions').select('*').order('created_at', { ascending: false });

        if (userRole === 'doctor') {
            query.eq('doctor_id', req.user.userId);
        } else {
            query.eq('patient_id', req.user.userId);
        }

        const { data, error } = await query;

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.status(200).json(data || []);
    } catch (e) {
        console.error('Server error fetching prescriptions:', e);
        res.status(500).json({ error: 'Internal server error while fetching prescriptions.' });
    }
});

// GET /api/patient/doctors: list doctors assigned to the authenticated patient
app.get('/api/patient/doctors', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'patient') {
            return res.status(400).json({ error: 'Only patient accounts can query their doctors.' });
        }

        // Fetch assignments for this patient
        const { data: assignments, error: assignError } = await supabase
            .from('patient_doctor_assignments')
            .select('doctor_id, notes, created_at')
            .eq('patient_id', req.user.userId);

        if (assignError) {
            return res.status(500).json({ error: assignError.message });
        }

        if (!assignments || assignments.length === 0) {
            return res.status(200).json([]);
        }

        const doctors = [];
        for (const assignment of assignments) {
            const { data: doctor, error: docError } = await supabase
                .from('users')
                .select('id, name, email')
                .eq('id', assignment.doctor_id)
                .single();

            if (doctor) {
                // Fetch doctor profile details
                const { data: profile } = await supabase
                    .from('doctor_profiles')
                    .select('*')
                    .eq('user_id', doctor.id)
                    .maybeSingle();

                doctors.push({
                    id: doctor.id,
                    name: doctor.name,
                    email: doctor.email,
                    specialty: profile?.specialty || 'General Medicine',
                    clinicName: profile?.clinic_name || 'N/A',
                    consultationMode: profile?.consultation_mode || 'Hybrid',
                    bio: profile?.bio || '',
                    yearsOfExperience: profile?.years_of_experience || 0,
                    notes: assignment.notes,
                    assignedAt: assignment.created_at
                });
            }
        }

        res.status(200).json(doctors);
    } catch (e) {
        console.error('Server error fetching patient doctors:', e);
        res.status(500).json({ error: 'Internal server error while fetching doctors.' });
    }
});

// POST /api/patient/doctors/connect: connect the patient to a doctor using doctor's email
app.post('/api/patient/doctors/connect', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'patient') {
            return res.status(400).json({ error: 'Only patient accounts can connect to a doctor.' });
        }

        const { doctorEmail, notes } = req.body || {};

        if (!doctorEmail) {
            return res.status(400).json({ error: 'Doctor email is required.' });
        }

        // Find doctor by email
        const { data: doctor, error: docError } = await supabase
            .from('users')
            .select('id, role, name')
            .eq('email', doctorEmail.trim().toLowerCase())
            .maybeSingle();

        if (docError || !doctor) {
            return res.status(400).json({ error: 'Doctor not found with this email.' });
        }

        if (doctor.role !== 'doctor') {
            return res.status(400).json({ error: 'Selected user is not registered as a doctor.' });
        }

        // Establish assignment
        const { error: assignmentError } = await supabase
            .from('patient_doctor_assignments')
            .upsert({
                doctor_id: doctor.id,
                patient_id: req.user.userId,
                assigned_by: req.user.userId,
                notes: notes || 'Connected by patient',
                updated_at: new Date().toISOString()
            }, { onConflict: 'doctor_id,patient_id' });

        if (assignmentError) {
            return res.status(500).json({ error: assignmentError.message });
        }

        res.status(200).json({ message: 'Connected to doctor successfully', doctor: { name: doctor.name, email: doctorEmail } });
    } catch (e) {
        console.error('Server error connecting to doctor:', e);
        res.status(500).json({ error: 'Internal server error while connecting to doctor.' });
    }
});

// POST /api/disease-prediction: Generate/refresh disease predictions for authenticated user
app.post('/api/disease-prediction', authenticateToken, async (req, res) => {
    try {
        const predictionService = new EnhancedPredictionService();
        const predictionResult = await predictionService.generatePredictions(req.user.userId);
        
        if (!predictionResult) {
            return res.status(400).json({ 
                error: 'No health data available for prediction. Please connect Google Fit and sync your data first.' 
            });
        }
        
        res.status(200).json(normalizePredictionPayload(predictionResult));
    } catch (e) {
        console.error("Server error in disease prediction:", e);
        // If no health data / Fit data found, return a user-friendly error instead of 500
        if (e.message && (
            e.message.includes('No Google Fit data') || 
            e.message.includes('No health data found') || 
            e.message.includes('Health Assessment')
        )) {
            return res.status(400).json({ error: e.message });
        }
        res.status(500).json({ error: 'Internal server error while generating predictions.' });
    }
});

// GET /api/doctor/profile: Get the authenticated doctor's profile
app.get('/api/doctor/profile', authenticateToken, requireRoles('doctor'), async (req, res) => {
    try {
        const profile = await getUserProfile(req.user.userId);
        res.status(200).json(profile);
    } catch (error) {
        console.error('Get doctor profile error:', error);
        res.status(404).json({ error: error.message });
    }
});

// GET /api/disease-prediction: Get existing disease predictions for authenticated user
app.get('/api/disease-prediction', authenticateToken, async (req, res) => {
    try {
        const predictionService = new EnhancedPredictionService();
        const predictions = await predictionService.getUserPredictions(req.user.userId);
        
        if (!predictions) {
            return res.status(200).json({ predictions: null, message: 'No predictions found for this user.' });
        }
        
        res.status(200).json(normalizePredictionPayload(predictions));
    } catch (e) {
        console.error("Server error fetching predictions:", e);
        res.status(500).json({ error: 'Internal server error while fetching predictions.' });
    }
});

// GET /api/risk-segmentation: Get latest risk segment for the authenticated user
app.get('/api/risk-segmentation', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('user_segments')
            .select('*')
            .eq('user_id', req.user.userId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('Error fetching risk segment:', error);
            return res.status(500).json({ error: error.message });
        }

        if (!data) {
            return res.status(200).json({ segment: null, message: 'No risk segmentation found for this user.' });
        }

        res.status(200).json(data);
    } catch (e) {
        console.error('Server error fetching risk segmentation:', e);
        res.status(500).json({ error: 'Internal server error while fetching risk segmentation.' });
    }
});

// GET /api/expert-monitoring: Get expert monitoring cases for the authenticated user
app.get('/api/expert-monitoring', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('expert_monitoring_cases')
            .select('*')
            .eq('user_id', req.user.userId)
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('Error fetching expert monitoring cases:', error);
            return res.status(500).json({ error: error.message });
        }

        res.status(200).json(data || []);
    } catch (e) {
        console.error('Server error fetching expert monitoring cases:', e);
        res.status(500).json({ error: 'Internal server error while fetching expert monitoring cases.' });
    }
});

// Start the server
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Node.js backend running on http://localhost:${PORT}`);
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            console.warn("WARNING: Supabase URL or Service Role Key is not set. Please configure your .env file.");
        }
        
        // Start disease scraping scheduler
        runInitialScraping();
        scheduleDiseaseScraping();
    });
}

module.exports = app;
