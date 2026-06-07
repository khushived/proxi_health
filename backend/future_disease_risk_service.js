const { createClient } = require('./supabase_wrapper');
const { exec } = require('child_process');
const axios = require('axios');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const FUTURE_DISEASES = [
    {
        key: 'cardiovascular_disease',
        label: 'Cardiovascular Disease',
        precautions: [
            'Do regular cardio and resistance exercise',
            'Keep blood pressure and heart rate under review',
            'Reduce salt, tobacco, and ultra-processed food intake'
        ]
    },
    {
        key: 'type_2_diabetes',
        label: 'Type 2 Diabetes',
        precautions: [
            'Keep weight and waist size under control',
            'Balance meals with fiber, protein, and slow carbs',
            'Check fasting glucose and HbA1c periodically'
        ]
    },
    {
        key: 'hypertension',
        label: 'Hypertension',
        precautions: [
            'Check blood pressure routinely',
            'Reduce sodium and maintain regular sleep',
            'Avoid tobacco and excess alcohol'
        ]
    },
    {
        key: 'obesity',
        label: 'Obesity',
        precautions: [
            'Create a sustainable calorie deficit with whole foods',
            'Walk daily and add strength training twice a week',
            'Track weight trends monthly'
        ]
    },
    {
        key: 'depression',
        label: 'Depression',
        precautions: [
            'Protect sleep consistency and daylight exposure',
            'Keep a predictable exercise routine',
            'Use mental-health support early if mood declines'
        ]
    }
];

function clampProbability(value) {
    return Math.max(0, Math.min(1, value));
}

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function calculateBmi(weight, height) {
    const weightKg = toNumber(weight, null);
    const heightCm = toNumber(height, null);

    if (!weightKg || !heightCm) {
        return null;
    }

    const heightMeters = heightCm / 100;
    if (heightMeters <= 0) {
        return null;
    }

    return weightKg / (heightMeters * heightMeters);
}

function assessRiskLevel(probability) {
    if (probability >= 0.7) return 'high';
    if (probability >= 0.4) return 'medium';
    return 'low';
}

// Helper to run Python Random Forest inference script
function runPythonInference(inputData) {
    return new Promise((resolve, reject) => {
        const path = require('path');
        const jsonString = JSON.stringify(inputData);
        // Escape double quotes for shell execution
        const escapedJson = jsonString.replace(/"/g, '\\"');
        const scriptPath = path.resolve(__dirname, '..', 'ml', 'infer_conditions.py');
        
        exec(`python "${scriptPath}" "${escapedJson}"`, (error, stdout, stderr) => {
            if (error) {
                console.error('Python ML execution error:', error, stderr);
                return reject(new Error('Failed to run Random Forest inference script'));
            }
            try {
                const result = JSON.parse(stdout.trim());
                if (result.error) {
                    return reject(new Error(result.error));
                }
                resolve(result);
            } catch (e) {
                console.error('Failed to parse Python ML output:', stdout);
                reject(new Error('Failed to parse Random Forest outputs'));
            }
        });
    });
}

// Generate future disease precautions using Groq AI (free) with static fallback
async function generateFutureAIPrecautions(diseaseName, riskLevel) {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) return null;

    try {
        const prompt = `You are a preventive medicine expert. Provide exactly 3 short, actionable precautions to prevent developing ${diseaseName} in the next 10 years, given a current risk level of "${riskLevel}". Return ONLY a JSON array of 3 strings. No markdown, no explanation.`;
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            { model: 'llama3-8b-8192', messages: [{ role: 'user', content: prompt }], max_tokens: 200, temperature: 0.4 },
            { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 7000 }
        );
        const text = response.data?.choices?.[0]?.message?.content?.trim();
        if (text) {
            const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, 3);
        }
    } catch (e) {
        console.error(`Groq future precaution error for ${diseaseName}:`, e.message);
    }
    return null;
}

async function storeFutureRiskSnapshot(userId, payload) {
    const { error } = await supabase
        .from('future_disease_predictions')
        .upsert({
            user_id: userId,
            predictions: payload.predictions,
            health_metrics: payload.healthMetrics,
            overall_health_score: payload.overallHealthScore,
            recommendations: payload.recommendations,
            risk_segment: payload.riskSegment,
            expert_monitoring: payload.expertMonitoring,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

    if (error) {
        console.error('Error storing future risk snapshot:', error);
    }
}

class FutureDiseaseRiskService {
    async generateFutureRisk(userId) {
        // Fetch user basic info
        const { data: userInfo, error: userError } = await supabase
            .from('users')
            .select('age, gender, weight, height, smoker, alcohol_consumption')
            .eq('id', userId)
            .single();

        if (userError || !userInfo) {
            throw new Error('User not found in database for future risk prediction');
        }

        // Fetch user's manually entered health data (replaces Google Fit)
        const { data: healthData } = await supabase
            .from('user_health_data')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        // Derive metrics from manually entered data
        const dailySteps = toNumber(healthData?.daily_steps, 0);
        const restingHR = toNumber(healthData?.resting_heart_rate, 72);
        const sleepHours = toNumber(healthData?.sleep_hours, 7.0);
        const deepSleepHours = toNumber(healthData?.deep_sleep_hours, 1.5);
        const stressLevel = healthData?.stress_level || 'medium';
        const physicalLevel = healthData?.physical_activity_level || 'lightly_active';
        const weeklyExercise = toNumber(healthData?.weekly_exercise_hours, 0);
        const dietQuality = healthData?.diet_quality || 'fair';
        const waterIntake = toNumber(healthData?.water_intake_liters, 2.0);
        const bloodOxygen = toNumber(healthData?.blood_oxygen_level, 98.0);
        const onMedication = healthData?.on_medication || false;
        const snoring = healthData?.snoring || false;
        const wakeupsPerNight = toNumber(healthData?.wakeups_per_night, 1);
        const mood = healthData?.mood || 'neutral';
        const chronicConditions = healthData?.chronic_conditions || [];

        // Estimate caloric burn from activity level
        const calorieBurnMap = { sedentary: 1800, lightly_active: 2100, moderately_active: 2400, very_active: 2800 };
        const dailyCalories = calorieBurnMap[physicalLevel] || 2100;
        const dailyDistance = dailySteps * 0.0008; // ~0.8m per step in km

        // Estimate additional inputs for ML model
        const bmi = calculateBmi(userInfo.weight, userInfo.height) || 22.0;
        const estBodyFat = clampProbability(((1.20 * bmi) + (0.23 * toNumber(userInfo.age, 30)) - (10.8 * (String(userInfo.gender).toLowerCase() === 'male' ? 1 : 0)) - 5.4) / 100) * 100;
        const estMuscleMass = toNumber(userInfo.weight, 70) * (1 - estBodyFat / 100);

        // Map stress level to ML expected format
        const stressMap = { low: 'Low', medium: 'Moderate', high: 'High' };
        const moodMap = { very_low: 'Sad', low: 'Anxious', neutral: 'Neutral', good: 'Happy', excellent: 'Happy' };

        // PROJECTING 10 YEARS IN THE FUTURE: Age = currentAge + 10
        const projectedAge = toNumber(userInfo.age, 30) + 10;

        const mlInput = {
            "Age": projectedAge,
            "Gender": userInfo.gender || "Male",
            "Weight": toNumber(userInfo.weight, 70.0),
            "Height": toNumber(userInfo.height, 170.0),
            "Medication": onMedication ? "Yes" : "No",
            "Smoker": userInfo.smoker || "No",
            "Alcohol_Consumption": userInfo.alcohol_consumption || "None",
            "Day_of_Week": "Monday",
            "Sleep_Duration": sleepHours,
            "Deep_Sleep_Duration": deepSleepHours,
            "REM_Sleep_Duration": Math.max(0, sleepHours - deepSleepHours - 1.0),
            "Wakeups": wakeupsPerNight,
            "Snoring": snoring ? "Yes" : "No",
            "Heart_Rate": restingHR,
            "Blood_Oxygen_Level": bloodOxygen,
            "ECG": "Normal",
            "Calories_Intake": dailyCalories,
            "Water_Intake": waterIntake,
            "Stress_Level": stressMap[stressLevel] || "Moderate",
            "Mood": moodMap[mood] || "Neutral",
            "Skin_Temperature": 36.5,
            "Body_Fat_Percentage": estBodyFat,
            "Muscle_Mass": estMuscleMass,
            "Health_Score": 80.0
        };

        // Call the Random Forest ML model using exec
        let mlOutputs;
        try {
            mlOutputs = await runPythonInference(mlInput);
        } catch (mlErr) {
            console.warn('ML Python run failed, using fallback probability estimator:', mlErr.message);
            // Fallback estimator
            mlOutputs = {
                prediction: "None",
                probabilities: {
                    "Diabetes": 0.25,
                    "Hypertension": 0.28,
                    "None": 0.47
                }
            };
        }

        const mlProbs = mlOutputs.probabilities || {};
        
        // Factor in chronic conditions from manual data
        const hasChronicDiabetes = chronicConditions.includes('diabetes');
        const hasChronicHypertension = chronicConditions.includes('hypertension');
        const hasChronicHeart = chronicConditions.includes('heart_disease');

        // Derive secondary risk calculations
        const pDiabetes = clampProbability((mlProbs.Diabetes ?? 0.2) + (hasChronicDiabetes ? 0.2 : 0));
        const pHypertension = clampProbability((mlProbs.Hypertension ?? 0.2) + (hasChronicHypertension ? 0.2 : 0));
        const pObesity = clampProbability((bmi > 30 ? 0.8 : bmi > 25 ? 0.4 : 0.1) + (dailySteps < 5000 ? 0.15 : 0));
        const pCardio = clampProbability(pHypertension * 0.7 + (String(userInfo.smoker).toLowerCase() === 'yes' ? 0.2 : 0) + (restingHR > 80 ? 0.1 : 0) + (hasChronicHeart ? 0.25 : 0));
        const pDepression = clampProbability((dailySteps < 4000 ? 0.3 : 0.1) + (userInfo.alcohol_consumption === 'Heavy' ? 0.15 : 0) + (stressLevel === 'high' ? 0.15 : 0));

        const rawRisks = {
            type_2_diabetes: pDiabetes,
            hypertension: pHypertension,
            obesity: pObesity,
            cardiovascular_disease: pCardio,
            depression: pDepression
        };

        // Build predictions payload with AI precautions
        const predictions = [];
        for (const [key, prob] of Object.entries(rawRisks)) {
            const disease = FUTURE_DISEASES.find((item) => item.key === key);
            const riskLevel = assessRiskLevel(prob);
            
            // Get dynamic precautions from Gemini
            let precautions = await generateFutureAIPrecautions(disease.label, riskLevel);
            if (!precautions) {
                // Fallback to static precautions
                precautions = disease.precautions;
            }

            predictions.push({
                disease: disease.label,
                key,
                probability: Number(prob.toFixed(3)),
                riskLevel,
                precautions,
                projectedIn: '10 years'
            });
        }
        
        // Sort risks descending by probability
        predictions.sort((a, b) => b.probability - a.probability);

        // Overall Health Score (0-100)
        const overallHealthScore = Math.max(0, Math.round(100 - (predictions.reduce((sum, item) => sum + item.probability * 100, 0) / predictions.length)));

        const recommendations = predictions.slice(0, 3).map((item) => ({
            disease: item.disease,
            riskLevel: item.riskLevel,
            probability: item.probability,
            precautions: item.precautions,
            summary: `Projected ${item.riskLevel} risk for ${item.disease} in 10 years`
        }));

        const payload = {
            predictions,
            healthMetrics: {
                age: projectedAge,
                bmi,
                avgHeartRate: restingHR,
                dailySteps: Math.round(dailySteps),
                dailyCalories: Math.round(dailyCalories),
                dailyDistance: Number(dailyDistance.toFixed(2)),
                smoker: userInfo.smoker || 'No',
                alcoholConsumption: userInfo.alcohol_consumption || 'None',
                estimatedBodyFat: Number(estBodyFat.toFixed(1)),
                estimatedMuscleMass: Number(estMuscleMass.toFixed(1)),
                sleepHours,
                stressLevel,
                physicalActivityLevel: physicalLevel,
                weeklyExerciseHours: weeklyExercise,
                dietQuality,
                chronicConditions
            },
            recommendations,
            overallHealthScore,
            riskSegment: {
                segment: overallHealthScore >= 75 ? 'low_risk' : overallHealthScore >= 50 ? 'moderate_risk' : overallHealthScore >= 30 ? 'high_risk' : 'critical_risk',
                segment_details: {
                    projectedAge,
                    bmi: Number(bmi.toFixed(1)),
                    topRisks: predictions.slice(0, 3)
                }
            },
            expertMonitoring: predictions[0].riskLevel === 'high' ? {
                status: 'open',
                escalation_level: 'priority',
                summary: `Projected high risk for ${predictions[0].disease}`
            } : null,
            lastUpdated: new Date().toISOString()
        };

        // Save to Supabase snapshot
        await storeFutureRiskSnapshot(userId, payload);

        return payload;
    }
}

module.exports = {
    FutureDiseaseRiskService
};