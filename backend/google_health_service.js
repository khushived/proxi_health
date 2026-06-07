// Google Health Service (Google Cloud Healthcare API) Integration
const { google } = require('googleapis');
const { createClient } = require('./supabase_wrapper');
require('dotenv').config();

// Supabase client
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Google Health (Cloud Healthcare) OAuth2 configuration
const GOOGLE_HEALTH_CLIENT_ID = process.env.GOOGLE_HEALTH_CLIENT_ID;
const GOOGLE_HEALTH_CLIENT_SECRET = process.env.GOOGLE_HEALTH_CLIENT_SECRET;
const GOOGLE_HEALTH_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/health_callback.html';

// Scopes for Google Cloud Healthcare API (FHIR)
const HEALTH_SCOPES = [
  'https://www.googleapis.com/auth/cloud-healthcare',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

// Initialize OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  GOOGLE_HEALTH_CLIENT_ID,
  GOOGLE_HEALTH_CLIENT_SECRET,
  GOOGLE_HEALTH_REDIRECT_URI
);

/**
 * Generate Google Health authorization URL for a user.
 * @param {string} userId - UUID of the user.
 * @returns {string} URL to redirect the user to.
 */
function getGoogleHealthAuthUrl(userId) {
  const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: HEALTH_SCOPES,
    prompt: 'consent',
    state,
  });
}

/**
 * Handle OAuth callback from Google Health.
 * Stores refreshed access/refresh tokens in `user_tokens` table.
 */
async function handleGoogleHealthCallback(code, state) {
  const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
  const { userId } = decodedState;

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Verify email matches stored user email (optional but recommended)
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();

  if (userErr) throw userErr;

  // Store tokens
  const { error: tokenErr } = await supabase
    .from('user_tokens')
    .upsert({
      user_id: userId,
      google_health_access_token: tokens.access_token,
      google_health_refresh_token: tokens.refresh_token,
      expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      google_email: tokens.id_token ? JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString()).email : null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  if (tokenErr) throw tokenErr;

  return { success: true, message: 'Google Health connected', userEmail: user.email };
}

/**
 * Refresh Google Health access token using stored refresh token.
 */
async function refreshGoogleHealthToken(userId) {
  const { data: tokenData, error: fetchErr } = await supabase
    .from('user_tokens')
    .select('google_health_refresh_token')
    .eq('user_id', userId)
    .single();

  if (fetchErr) throw fetchErr;
  if (!tokenData || !tokenData.google_health_refresh_token) {
    throw new Error('No Google Health refresh token found');
  }

  oauth2Client.setCredentials({ refresh_token: tokenData.google_health_refresh_token });
  const { credentials } = await oauth2Client.refreshAccessToken();

  await supabase
    .from('user_tokens')
    .update({
      google_health_access_token: credentials.access_token,
      expires_at: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  return credentials.access_token;
}

/**
 * Placeholder for fetching health data. In a real implementation you would call
 * the Google Cloud Healthcare FHIR APIs here using the access token.
 */
async function fetchUserHealthData(userId) {
  // Example: retrieve a FHIR Patient resource
  // const fhir = google.healthcare({ version: 'v1', auth: oauth2Client });
  // const patient = await fhir.projects.locations.datasets.fhirStores.fhirResources.get({
  //   name: `projects/${process.env.GOOGLE_HEALTH_PROJECT_ID}/locations/.../fhirStores/.../Patient/${userId}`
  // });

  // Fetch manually entered health data from Supabase
  const { data: healthData, error } = await supabase
    .from('user_health_data')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user health data:', error);
    throw error;
  }

  if (!healthData) {
    throw new Error('No health data found. Please complete the Health Assessment form first.');
  }

  // Return data in format expected by the prediction service
  return {
    steps: healthData.daily_steps,
    heartRate: healthData.resting_heart_rate,
    sleepHours: healthData.sleep_hours,
    deepSleepHours: healthData.deep_sleep_hours,
    stressLevel: healthData.stress_level,
    physicalActivityLevel: healthData.physical_activity_level,
    weeklyExerciseHours: healthData.weekly_exercise_hours,
    chronicConditions: healthData.chronic_conditions,
    familyHistory: healthData.family_history,
    currentSymptoms: healthData.current_symptoms,
    dietQuality: healthData.diet_quality,
    waterIntakeLiters: healthData.water_intake_liters,
    bloodOxygenLevel: healthData.blood_oxygen_level,
    lastCheckupMonths: healthData.last_checkup_months,
    onMedication: healthData.on_medication,
    medicationDetails: healthData.medication_details,
    snoring: healthData.snoring,
    wakeupsPerNight: healthData.wakeups_per_night,
    mood: healthData.mood,
  };
}

module.exports = {
  getGoogleHealthAuthUrl,
  handleGoogleHealthCallback,
  refreshGoogleHealthToken,
  fetchUserHealthData
};
