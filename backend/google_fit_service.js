// Google Fit Integration Service
const { google } = require('googleapis');
const { createClient } = require('./supabase_wrapper');
require('dotenv').config();

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Google Fit API Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/callback.html';

// Initialize Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
);

// Fetch Google Fit data for a user
async function fetchGoogleFitData(accessToken, userId) {
    try {
        oauth2Client.setCredentials({ access_token: accessToken });
        
        const fitness = google.fitness({ version: 'v1', auth: oauth2Client });
        
        // Get data for the last 7 days
        const endTime = new Date();
        const startTime = new Date();
        startTime.setDate(startTime.getDate() - 7);
        
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

module.exports = {
    fetchGoogleFitData,
    storeGoogleFitData
};