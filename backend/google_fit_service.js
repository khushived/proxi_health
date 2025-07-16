// Google Fit Integration and Disease Prediction Service
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config();

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Google Fit API Configuration
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
    'https://www.googleapis.com/auth/fitness.location.read'
];

// Generate OAuth2 authorization URL
function getAuthUrl() {
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
    });
}

// Exchange authorization code for tokens
async function getTokensFromCode(code) {
    try {
        const { tokens } = await oauth2Client.getToken(code);
        return tokens;
    } catch (error) {
        console.error('Error getting tokens:', error);
        throw error;
    }
}

// Fetch Google Fit data for a user
async function fetchGoogleFitData(accessToken, userId) {
    try {
        oauth2Client.setCredentials({ access_token: accessToken });
        
        const fitness = google.fitness({ version: 'v1', auth: oauth2Client });
        
        // Get data for the last 7 days
        const endTime = new Date();
        const startTime = new Date();
        startTime.setDate(startTime.getDate() - 7);
        
        const dataSources = [
            'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps',
            'derived:com.google.calories.expended:com.google.android.gms:from_activities',
            'derived:com.google.heart_rate.bpm:com.google.android.gms:from_sensors',
            'derived:com.google.distance.delta:com.google.android.gms:from_activities',
            'derived:com.google.activity.segment:com.google.android.gms:from_activities'
        ];
        
        const fitData = {
            steps: 0,
            calories: 0,
            heartRate: [],
            distance: 0,
            activities: [],
            lastSync: new Date().toISOString()
        };
        
        // Fetch step count
        try {
            const stepsResponse = await fitness.users.dataSources.datasets.get({
                userId: 'me',
                dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps',
                datasetId: `${startTime.getTime()}-${endTime.getTime()}`
            });
            
            if (stepsResponse.data.point) {
                fitData.steps = stepsResponse.data.point.reduce((total, point) => {
                    return total + (point.value[0].intVal || 0);
                }, 0);
            }
        } catch (error) {
            console.log('Could not fetch step data:', error.message);
        }
        
        // Fetch calories
        try {
            const caloriesResponse = await fitness.users.dataSources.datasets.get({
                userId: 'me',
                dataSourceId: 'derived:com.google.calories.expended:com.google.android.gms:from_activities',
                datasetId: `${startTime.getTime()}-${endTime.getTime()}`
            });
            
            if (caloriesResponse.data.point) {
                fitData.calories = caloriesResponse.data.point.reduce((total, point) => {
                    return total + (point.value[0].fpVal || 0);
                }, 0);
            }
        } catch (error) {
            console.log('Could not fetch calorie data:', error.message);
        }
        
        // Fetch heart rate
        try {
            const heartRateResponse = await fitness.users.dataSources.datasets.get({
                userId: 'me',
                dataSourceId: 'derived:com.google.heart_rate.bpm:com.google.android.gms:from_sensors',
                datasetId: `${startTime.getTime()}-${endTime.getTime()}`
            });
            
            if (heartRateResponse.data.point) {
                fitData.heartRate = heartRateResponse.data.point.map(point => ({
                    value: point.value[0].fpVal,
                    timestamp: point.startTimeNanos
                }));
            }
        } catch (error) {
            console.log('Could not fetch heart rate data:', error.message);
        }
        
        // Fetch distance
        try {
            const distanceResponse = await fitness.users.dataSources.datasets.get({
                userId: 'me',
                dataSourceId: 'derived:com.google.distance.delta:com.google.android.gms:from_activities',
                datasetId: `${startTime.getTime()}-${endTime.getTime()}`
            });
            
            if (distanceResponse.data.point) {
                fitData.distance = distanceResponse.data.point.reduce((total, point) => {
                    return total + (point.value[0].fpVal || 0);
                }, 0);
            }
        } catch (error) {
            console.log('Could not fetch distance data:', error.message);
        }
        
        // Store the data in Supabase
        await storeGoogleFitData(userId, fitData);
        
        return fitData;
        
    } catch (error) {
        console.error('Error fetching Google Fit data:', error);
        throw error;
    }
}

// Store Google Fit data in Supabase
async function storeGoogleFitData(userId, fitData) {
    try {
        const { data, error } = await supabase
            .from('google_fit_data')
            .upsert({
                user_id: userId,
                steps: fitData.steps,
                calories: fitData.calories,
                heart_rate_data: fitData.heartRate,
                distance: fitData.distance,
                activities: fitData.activities,
                last_sync: fitData.lastSync,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            })
            .select();
            
        if (error) {
            console.error('Error storing Google Fit data:', error);
            return false;
        }
        
        console.log(`Google Fit data stored for user ${userId}`);
        return true;
    } catch (error) {
        console.error('Error in storeGoogleFitData:', error);
        return false;
    }
}

// Disease prediction based on Google Fit data
async function predictDiseases(userId) {
    try {
        // Get user's Google Fit data
        const { data: fitData, error } = await supabase
            .from('google_fit_data')
            .select('*')
            .eq('user_id', userId)
            .single();
            
        if (error || !fitData) {
            console.error('No Google Fit data found for user:', userId);
            return null;
        }
        
        // Get user's basic info (age, gender, etc.) - you might want to add this to your user table
        const { data: userInfo } = await supabase
            .from('users')
            .select('age, gender, weight, height')
            .eq('id', userId)
            .single();
        
        // Calculate health metrics
        const healthMetrics = calculateHealthMetrics(fitData, userInfo);
        
        // Predict diseases using ML model
        const predictions = await runDiseasePrediction(healthMetrics);
        
        // Store predictions in database
        await storeDiseasePredictions(userId, predictions, healthMetrics);
        
        return {
            predictions,
            healthMetrics,
            recommendations: generateRecommendations(predictions, healthMetrics)
        };
        
    } catch (error) {
        console.error('Error in disease prediction:', error);
        return null;
    }
}

// Calculate health metrics from Google Fit data
function calculateHealthMetrics(fitData, userInfo) {
    const avgHeartRate = fitData.heart_rate_data && fitData.heart_rate_data.length > 0
        ? fitData.heart_rate_data.reduce((sum, hr) => sum + hr.value, 0) / fitData.heart_rate_data.length
        : 70;
    
    const dailySteps = fitData.steps / 7; // Average daily steps over 7 days
    const dailyCalories = fitData.calories / 7;
    const dailyDistance = fitData.distance / 7;
    
    // Calculate BMI if weight and height are available
    let bmi = null;
    if (userInfo && userInfo.weight && userInfo.height) {
        const heightInMeters = userInfo.height / 100;
        bmi = userInfo.weight / (heightInMeters * heightInMeters);
    }
    
    return {
        avgHeartRate,
        dailySteps,
        dailyCalories,
        dailyDistance,
        bmi,
        age: userInfo?.age || 30,
        gender: userInfo?.gender || 'unknown',
        activityLevel: getActivityLevel(dailySteps),
        cardiovascularHealth: assessCardiovascularHealth(avgHeartRate, dailySteps),
        metabolicHealth: assessMetabolicHealth(dailyCalories, dailySteps, bmi)
    };
}

// Get activity level based on daily steps
function getActivityLevel(dailySteps) {
    if (dailySteps < 5000) return 'sedentary';
    if (dailySteps < 7500) return 'lightly_active';
    if (dailySteps < 10000) return 'moderately_active';
    return 'very_active';
}

// Assess cardiovascular health
function assessCardiovascularHealth(heartRate, dailySteps) {
    let score = 0;
    
    // Heart rate assessment
    if (heartRate >= 60 && heartRate <= 100) score += 3;
    else if (heartRate < 60 || heartRate > 100) score += 1;
    
    // Activity level assessment
    if (dailySteps >= 10000) score += 3;
    else if (dailySteps >= 7500) score += 2;
    else if (dailySteps >= 5000) score += 1;
    
    if (score >= 5) return 'excellent';
    if (score >= 3) return 'good';
    if (score >= 2) return 'fair';
    return 'poor';
}

// Assess metabolic health
function assessMetabolicHealth(calories, steps, bmi) {
    let score = 0;
    
    // Calorie burn assessment
    if (calories >= 300) score += 2;
    else if (calories >= 200) score += 1;
    
    // Activity assessment
    if (steps >= 10000) score += 2;
    else if (steps >= 7500) score += 1;
    
    // BMI assessment
    if (bmi && bmi >= 18.5 && bmi <= 24.9) score += 2;
    else if (bmi && bmi >= 17 && bmi <= 29.9) score += 1;
    
    if (score >= 5) return 'excellent';
    if (score >= 3) return 'good';
    if (score >= 2) return 'fair';
    return 'poor';
}

// Run disease prediction using ML model
async function runDiseasePrediction(healthMetrics) {
    // This is a simplified prediction model
    // In production, you would use a trained ML model
    
    const predictions = {
        cardiovascular_disease: {
            risk: 'low',
            probability: 0.15,
            factors: []
        },
        type_2_diabetes: {
            risk: 'low',
            probability: 0.12,
            factors: []
        },
        obesity: {
            risk: 'low',
            probability: 0.10,
            factors: []
        },
        hypertension: {
            risk: 'low',
            probability: 0.18,
            factors: []
        },
        depression: {
            risk: 'low',
            probability: 0.08,
            factors: []
        }
    };
    
    // Adjust predictions based on health metrics
    
    // Cardiovascular disease risk
    if (healthMetrics.cardiovascularHealth === 'poor') {
        predictions.cardiovascular_disease.risk = 'high';
        predictions.cardiovascular_disease.probability = 0.65;
        predictions.cardiovascular_disease.factors.push('Poor cardiovascular health');
    } else if (healthMetrics.cardiovascularHealth === 'fair') {
        predictions.cardiovascular_disease.risk = 'medium';
        predictions.cardiovascular_disease.probability = 0.35;
        predictions.cardiovascular_disease.factors.push('Fair cardiovascular health');
    }
    
    if (healthMetrics.avgHeartRate > 100) {
        predictions.cardiovascular_disease.probability += 0.1;
        predictions.cardiovascular_disease.factors.push('Elevated heart rate');
    }
    
    // Diabetes risk
    if (healthMetrics.metabolicHealth === 'poor') {
        predictions.type_2_diabetes.risk = 'high';
        predictions.type_2_diabetes.probability = 0.55;
        predictions.type_2_diabetes.factors.push('Poor metabolic health');
    }
    
    if (healthMetrics.bmi && healthMetrics.bmi > 30) {
        predictions.type_2_diabetes.probability += 0.2;
        predictions.type_2_diabetes.factors.push('High BMI');
    }
    
    // Obesity risk
    if (healthMetrics.bmi && healthMetrics.bmi > 30) {
        predictions.obesity.risk = 'high';
        predictions.obesity.probability = 0.8;
        predictions.obesity.factors.push('High BMI');
    } else if (healthMetrics.bmi && healthMetrics.bmi > 25) {
        predictions.obesity.risk = 'medium';
        predictions.obesity.probability = 0.4;
        predictions.obesity.factors.push('Overweight');
    }
    
    // Hypertension risk
    if (healthMetrics.avgHeartRate > 90) {
        predictions.hypertension.risk = 'medium';
        predictions.hypertension.probability = 0.4;
        predictions.hypertension.factors.push('Elevated heart rate');
    }
    
    // Depression risk (based on activity level)
    if (healthMetrics.activityLevel === 'sedentary') {
        predictions.depression.risk = 'medium';
        predictions.depression.probability = 0.3;
        predictions.depression.factors.push('Low physical activity');
    }
    
    return predictions;
}

// Generate health recommendations
function generateRecommendations(predictions, healthMetrics) {
    const recommendations = [];
    
    // Cardiovascular recommendations
    if (predictions.cardiovascular_disease.risk === 'high') {
        recommendations.push({
            category: 'cardiovascular',
            priority: 'high',
            title: 'Improve Cardiovascular Health',
            description: 'Your cardiovascular health needs attention. Consider increasing physical activity and consulting a healthcare provider.',
            actions: [
                'Aim for at least 10,000 steps daily',
                'Include cardio exercises in your routine',
                'Monitor your heart rate regularly',
                'Schedule a checkup with your doctor'
            ]
        });
    }
    
    // Activity recommendations
    if (healthMetrics.dailySteps < 7500) {
        recommendations.push({
            category: 'activity',
            priority: 'medium',
            title: 'Increase Physical Activity',
            description: 'Your daily step count is below recommended levels.',
            actions: [
                'Set a goal of 10,000 steps per day',
                'Take walking breaks during work',
                'Use stairs instead of elevators',
                'Consider joining a fitness class'
            ]
        });
    }
    
    // Weight management recommendations
    if (healthMetrics.bmi && healthMetrics.bmi > 25) {
        recommendations.push({
            category: 'weight',
            priority: 'medium',
            title: 'Weight Management',
            description: 'Your BMI indicates you may benefit from weight management strategies.',
            actions: [
                'Consult a nutritionist for a balanced diet plan',
                'Increase physical activity gradually',
                'Monitor your calorie intake',
                'Set realistic weight loss goals'
            ]
        });
    }
    
    return recommendations;
}

// Store disease predictions in database
async function storeDiseasePredictions(userId, predictions, healthMetrics) {
    try {
        const { data, error } = await supabase
            .from('disease_predictions')
            .upsert({
                user_id: userId,
                predictions: predictions,
                health_metrics: healthMetrics,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            })
            .select();
            
        if (error) {
            console.error('Error storing disease predictions:', error);
            return false;
        }
        
        console.log(`Disease predictions stored for user ${userId}`);
        return true;
    } catch (error) {
        console.error('Error in storeDiseasePredictions:', error);
        return false;
    }
}

// Get user's disease predictions
async function getUserPredictions(userId) {
    try {
        const { data, error } = await supabase
            .from('disease_predictions')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();
            
        if (error) {
            console.error('Error fetching predictions:', error);
            return null;
        }
        
        return data;
    } catch (error) {
        console.error('Error in getUserPredictions:', error);
        return null;
    }
}

module.exports = {
    getAuthUrl,
    getTokensFromCode,
    fetchGoogleFitData,
    predictDiseases,
    getUserPredictions,
    storeGoogleFitData
}; 