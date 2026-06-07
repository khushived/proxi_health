const { fetchUserHealthData } = require('./google_health_service');
const { createClient } = require('./supabase_wrapper');
const { checkLocationAlerts } = require('./disease_scraper');
require('dotenv').config();

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Health Risk Assessment Models
class HealthRiskAssessment {
    constructor() {
        // Risk factors and their weights for different diseases
        this.riskFactors = {
            cardiovascular_disease: {
                age: { weight: 0.3, thresholds: { low: 30, medium: 50, high: 65 } },
                heartRate: { weight: 0.25, thresholds: { low: 60, medium: 80, high: 100 } },
                activityLevel: { weight: 0.2, thresholds: { sedentary: 0.8, lightly_active: 0.6, moderately_active: 0.3, very_active: 0.1 } },
                bmi: { weight: 0.15, thresholds: { low: 18.5, medium: 25, high: 30 } },
                gender: { weight: 0.1, thresholds: { male: 1.2, female: 1.0 } }
            },
            type_2_diabetes: {
                age: { weight: 0.25, thresholds: { low: 30, medium: 45, high: 60 } },
                bmi: { weight: 0.3, thresholds: { low: 18.5, medium: 25, high: 30 } },
                activityLevel: { weight: 0.25, thresholds: { sedentary: 0.8, lightly_active: 0.6, moderately_active: 0.3, very_active: 0.1 } },
                familyHistory: { weight: 0.2, thresholds: { yes: 1.5, no: 1.0 } }
            },
            obesity: {
                bmi: { weight: 0.4, thresholds: { low: 18.5, medium: 25, high: 30 } },
                activityLevel: { weight: 0.3, thresholds: { sedentary: 0.9, lightly_active: 0.7, moderately_active: 0.4, very_active: 0.1 } },
                calories: { weight: 0.2, thresholds: { low: 1500, medium: 2000, high: 2500 } },
                age: { weight: 0.1, thresholds: { low: 30, medium: 50, high: 65 } }
            },
            hypertension: {
                age: { weight: 0.25, thresholds: { low: 30, medium: 50, high: 65 } },
                heartRate: { weight: 0.3, thresholds: { low: 60, medium: 80, high: 100 } },
                bmi: { weight: 0.25, thresholds: { low: 18.5, medium: 25, high: 30 } },
                stressLevel: { weight: 0.2, thresholds: { low: 0.3, medium: 0.6, high: 0.9 } }
            },
            depression: {
                activityLevel: { weight: 0.35, thresholds: { sedentary: 0.8, lightly_active: 0.6, moderately_active: 0.3, very_active: 0.1 } },
                sleepQuality: { weight: 0.25, thresholds: { poor: 0.8, fair: 0.5, good: 0.2 } },
                socialActivity: { weight: 0.2, thresholds: { low: 0.7, medium: 0.4, high: 0.1 } },
                stressLevel: { weight: 0.2, thresholds: { low: 0.2, medium: 0.5, high: 0.8 } }
            },
            respiratory_diseases: {
                age: { weight: 0.2, thresholds: { low: 30, medium: 50, high: 65 } },
                activityLevel: { weight: 0.3, thresholds: { sedentary: 0.6, lightly_active: 0.4, moderately_active: 0.2, very_active: 0.1 } },
                environmentalFactors: { weight: 0.25, thresholds: { urban: 0.7, suburban: 0.4, rural: 0.2 } },
                smokingHistory: { weight: 0.25, thresholds: { yes: 0.8, no: 0.2 } }
            }
        };

        // Disease prevalence rates (based on general population data)
        this.prevalenceRates = {
            cardiovascular_disease: 0.12,
            type_2_diabetes: 0.08,
            obesity: 0.15,
            hypertension: 0.18,
            depression: 0.06,
            respiratory_diseases: 0.10
        };
    }

    // Calculate risk score for a specific disease
    calculateRiskScore(disease, healthMetrics) {
        const factors = this.riskFactors[disease];
        let totalScore = 0;
        let totalWeight = 0;
        const contributingFactors = [];

        for (const [factor, config] of Object.entries(factors)) {
            const value = healthMetrics[factor];
            if (value !== undefined && value !== null) {
                const riskValue = this.calculateFactorRisk(factor, value, config);
                totalScore += riskValue * config.weight;
                totalWeight += config.weight;
                
                if (riskValue > 0.5) {
                    contributingFactors.push({
                        factor: factor,
                        value: value,
                        risk: riskValue,
                        description: this.getFactorDescription(factor, value, riskValue)
                    });
                }
            }
        }

        const normalizedScore = totalWeight > 0 ? totalScore / totalWeight : 0;
        const adjustedScore = this.adjustForPrevalence(disease, normalizedScore);

        return {
            score: adjustedScore,
            risk: this.categorizeRisk(adjustedScore),
            probability: Math.min(adjustedScore, 0.95), // Cap at 95%
            factors: contributingFactors
        };
    }

    // Calculate individual factor risk
    calculateFactorRisk(factor, value, config) {
        const thresholds = config.thresholds;
        
        switch (factor) {
            case 'age':
                if (value < thresholds.low) return 0.1;
                if (value < thresholds.medium) return 0.3;
                if (value < thresholds.high) return 0.6;
                return 0.9;

            case 'heartRate':
                if (value < thresholds.low) return 0.2;
                if (value < thresholds.medium) return 0.4;
                if (value < thresholds.high) return 0.7;
                return 0.9;

            case 'bmi':
                if (value < thresholds.low) return 0.3;
                if (value < thresholds.medium) return 0.5;
                if (value < thresholds.high) return 0.7;
                return 0.9;

            case 'activityLevel':
                return thresholds[value] || 0.5;

            case 'gender':
                return thresholds[value] || 1.0;

            case 'calories':
                if (value < thresholds.low) return 0.3;
                if (value < thresholds.medium) return 0.5;
                if (value < thresholds.high) return 0.7;
                return 0.9;

            default:
                return thresholds[value] || 0.5;
        }
    }

    // Adjust risk score based on disease prevalence
    adjustForPrevalence(disease, score) {
        const prevalence = this.prevalenceRates[disease];
        return score * (1 + prevalence);
    }

    // Categorize risk level
    categorizeRisk(score) {
        if (score < 0.3) return 'low';
        if (score < 0.6) return 'medium';
        return 'high';
    }

    // Get factor description
    getFactorDescription(factor, value, risk) {
        switch (factor) {
            case 'age':
                return `Age ${value} years`;
            case 'heartRate':
                return `Heart rate ${value} bpm`;
            case 'bmi':
                return `BMI ${value}`;
            case 'activityLevel':
                return `${typeof value === 'string' ? value.replace('_', ' ') : value} lifestyle`;
            case 'calories':
                return `${value} daily calories`;
            case 'gender':
                return value === 'male' ? 'Male gender' : 'Female gender';
            default:
                return `${factor}: ${value}`;
        }
    }

    // Calculate comprehensive health metrics
    calculateHealthMetrics(fitData, userInfo) {
        const isManual = fitData.is_manual === true;

        const avgHeartRate = isManual
            ? (fitData.heartRate || 70)
            : (fitData.heart_rate_data && fitData.heart_rate_data.length > 0
                ? fitData.heart_rate_data.reduce((sum, hr) => sum + hr.value, 0) / fitData.heart_rate_data.length
                : 70);

        const dailySteps = fitData.steps / 7;
        const dailyCalories = fitData.calories / 7;
        const dailyDistance = fitData.distance / 7;

        // Calculate BMI
        let bmi = null;
        if (userInfo && userInfo.weight && userInfo.height) {
            const heightInMeters = userInfo.height / 100;
            bmi = userInfo.weight / (heightInMeters * heightInMeters);
        }

        // Determine activity level
        const activityLevel = isManual
            ? (fitData.activityLevel || 'lightly_active')
            : this.determineActivityLevel(dailySteps, dailyCalories);

        // Calculate stress level based on heart rate variability
        const stressLevel = isManual
            ? (fitData.stressLevel || 'medium')
            : this.calculateStressLevel(fitData.heart_rate_data);

        // Estimate sleep quality based on activity patterns
        const sleepQuality = isManual
            ? (fitData.sleepQuality || 'good')
            : this.estimateSleepQuality(fitData);

        return {
            age: userInfo?.age || 30,
            gender: userInfo?.gender || 'unknown',
            heartRate: avgHeartRate,
            bmi: bmi,
            activityLevel: activityLevel,
            calories: dailyCalories,
            steps: dailySteps,
            distance: dailyDistance,
            stressLevel: stressLevel,
            sleepQuality: sleepQuality,
            socialActivity: 'medium', // Default value
            familyHistory: isManual && fitData.familyHistory ? fitData.familyHistory : 'unknown', // Map family history
            environmentalFactors: 'urban', // Default value
            smokingHistory: userInfo?.smoker === true || userInfo?.smoker === 'yes' ? 'yes' : 'no' // Map smoking history
        };
    }

    // Determine activity level
    determineActivityLevel(steps, calories) {
        if (steps >= 10000 && calories >= 300) return 'very_active';
        if (steps >= 7500 && calories >= 250) return 'moderately_active';
        if (steps >= 5000 && calories >= 200) return 'lightly_active';
        return 'sedentary';
    }

    // Calculate stress level from heart rate data
    calculateStressLevel(heartRateData) {
        if (!heartRateData || heartRateData.length < 10) return 0.5;

        // Calculate heart rate variability
        const rates = heartRateData.map(hr => hr.value);
        const mean = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
        const variance = rates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / rates.length;
        const stdDev = Math.sqrt(variance);

        // Lower HRV indicates higher stress
        if (stdDev < 5) return 0.8; // High stress
        if (stdDev < 10) return 0.6; // Medium stress
        return 0.3; // Low stress
    }

    // Estimate sleep quality
    estimateSleepQuality(fitData) {
        // This is a simplified estimation
        // In a real application, you'd use actual sleep data from Google Fit
        const avgSteps = fitData.steps / 7;
        const avgCalories = fitData.calories / 7;

        if (avgSteps < 3000 && avgCalories < 150) return 'poor';
        if (avgSteps < 6000 && avgCalories < 250) return 'fair';
        return 'good';
    }

    // Generate personalized recommendations
    generateRecommendations(predictions, healthMetrics) {
        const recommendations = [];

        // Cardiovascular recommendations
        if (predictions.cardiovascular_disease.risk === 'high') {
            recommendations.push({
                category: 'cardiovascular',
                priority: 'high',
                title: 'Improve Cardiovascular Health',
                description: 'Your cardiovascular health needs immediate attention.',
                actions: [
                    'Schedule a comprehensive heart health checkup',
                    'Aim for 150 minutes of moderate exercise weekly',
                    'Monitor blood pressure regularly',
                    'Reduce sodium intake to less than 2,300mg daily',
                    'Consider stress management techniques'
                ],
                timeline: 'Within 1 month'
            });
        }

        // Diabetes prevention
        if (predictions.type_2_diabetes.risk === 'high') {
            recommendations.push({
                category: 'diabetes',
                priority: 'high',
                title: 'Diabetes Prevention',
                description: 'Take steps to prevent type 2 diabetes.',
                actions: [
                    'Get blood glucose screening',
                    'Increase fiber intake to 25-30g daily',
                    'Reduce refined carbohydrate consumption',
                    'Maintain healthy weight',
                    'Exercise regularly (30 minutes daily)'
                ],
                timeline: 'Within 2 weeks'
            });
        }

        // Weight management
        if (predictions.obesity.risk === 'high') {
            recommendations.push({
                category: 'weight',
                priority: 'medium',
                title: 'Weight Management',
                description: 'Focus on sustainable weight management.',
                actions: [
                    'Create a calorie deficit of 500-750 calories daily',
                    'Increase protein intake to 1.2-1.6g per kg body weight',
                    'Include strength training 2-3 times weekly',
                    'Track food intake consistently',
                    'Get adequate sleep (7-9 hours)'
                ],
                timeline: 'Ongoing'
            });
        }

        // Activity recommendations
        if (healthMetrics.activityLevel === 'sedentary') {
            recommendations.push({
                category: 'activity',
                priority: 'medium',
                title: 'Increase Physical Activity',
                description: 'Your activity level is below recommended standards.',
                actions: [
                    'Start with 10-minute walks 3 times daily',
                    'Use stairs instead of elevators',
                    'Take walking breaks during work',
                    'Join a fitness class or sports activity',
                    'Set a goal of 10,000 steps daily'
                ],
                timeline: 'Start immediately'
            });
        }

        // Mental health
        if (predictions.depression.risk === 'medium' || predictions.depression.risk === 'high') {
            recommendations.push({
                category: 'mental_health',
                priority: 'medium',
                title: 'Mental Health Support',
                description: 'Consider mental health support and stress management.',
                actions: [
                    'Practice mindfulness or meditation daily',
                    'Maintain regular sleep schedule',
                    'Stay socially connected with friends and family',
                    'Consider talking to a mental health professional',
                    'Engage in activities you enjoy'
                ],
                timeline: 'Within 1 month'
            });
        }

        return recommendations;
    }
}

// Enhanced prediction service
class EnhancedPredictionService {
    constructor() {
        this.riskAssessment = new HealthRiskAssessment();
    }

    async getNearbyOutbreakCount(userId, radiusKm = 50) {
        const { data: latestRecord, error: recordError } = await supabase
            .from('health_records')
            .select('location_data, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (recordError || !latestRecord?.location_data?.latitude || !latestRecord?.location_data?.longitude) {
            return { count: 0, outbreaks: [] };
        }

        const nearby = await checkLocationAlerts(
            latestRecord.location_data.latitude,
            latestRecord.location_data.longitude,
            radiusKm
        );

        return { count: nearby.length, outbreaks: nearby };
    }

    deriveRiskSegment(predictions, overallHealthScore, nearbyOutbreakCount) {
        const highRisks = Object.values(predictions || {}).filter((prediction) => prediction.risk === 'high').length;
        const mediumRisks = Object.values(predictions || {}).filter((prediction) => prediction.risk === 'medium').length;

        let segment = 'low_risk';
        const reasons = [];

        if (overallHealthScore < 40 || highRisks >= 3) {
            segment = 'critical_risk';
            reasons.push('Very low health score or multiple high-risk disease signals');
        } else if (overallHealthScore < 60 || highRisks >= 2 || (highRisks >= 1 && nearbyOutbreakCount > 0)) {
            segment = 'high_risk';
            reasons.push('Elevated disease risk and/or local outbreak exposure');
        } else if (overallHealthScore < 80 || mediumRisks >= 2 || nearbyOutbreakCount > 0) {
            segment = 'moderate_risk';
            reasons.push('Moderate health indicators requiring closer tracking');
        } else {
            reasons.push('Stable health profile with low immediate risk');
        }

        if (nearbyOutbreakCount > 0) {
            reasons.push(`${nearbyOutbreakCount} nearby outbreak(s) detected in the last 24 hours`);
        }

        return {
            segment,
            highRisks,
            mediumRisks,
            nearbyOutbreakCount,
            overallHealthScore,
            reasons
        };
    }

    async storeRiskSegment(userId, segmentData) {
        const { data, error } = await supabase
            .from('user_segments')
            .upsert({
                user_id: userId,
                segment: segmentData.segment,
                segment_details: segmentData,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            })
            .select()
            .maybeSingle();

        if (error) {
            console.error('Error storing user segment:', error);
            return null;
        }

        return data;
    }

    async upsertExpertMonitoringCase(userId, segmentData, predictions, nearbyOutbreaks) {
        const needsMonitoring = segmentData.segment === 'high_risk' || segmentData.segment === 'critical_risk';

        if (!needsMonitoring) {
            return {
                required: false,
                caseId: null,
                status: 'not_required'
            };
        }

        const escalationLevel = segmentData.segment === 'critical_risk' ? 'urgent' : 'priority';
        const summary = `Auto-escalated for ${segmentData.segment} with ${segmentData.highRisks} high-risk disease signal(s)`;

        const payload = {
            user_id: userId,
            status: 'open',
            escalation_level: escalationLevel,
            summary,
            case_context: {
                segment: segmentData,
                nearbyOutbreaks: nearbyOutbreaks || [],
                topRisks: Object.entries(predictions)
                    .filter(([, value]) => value.risk === 'high' || value.risk === 'medium')
                    .map(([disease, value]) => ({ disease, risk: value.risk, probability: value.probability }))
            },
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('expert_monitoring_cases')
            .upsert(payload, { onConflict: 'user_id' })
            .select()
            .maybeSingle();

        if (error) {
            console.error('Error upserting expert monitoring case:', error);
            return {
                required: true,
                caseId: null,
                status: 'error'
            };
        }

        return {
            required: true,
            caseId: data?.id || null,
            status: data?.status || 'open',
            escalationLevel
        };
    }

    // Generate comprehensive health predictions
    async generatePredictions(userId) {
        try {
            // Get user's health data via Google Health service (or manual entry)
            const healthData = await fetchUserHealthData(userId);

            // Map manual health data fields
            const calorieBurnMap = { sedentary: 1800, lightly_active: 2100, active: 2500, very_active: 2800 };
            const dailyCalories = calorieBurnMap[healthData.physicalActivityLevel] || 2100;

            const sleepQuality = healthData.sleepHours >= 7 && healthData.wakeupsPerNight <= 1 
                ? 'good' 
                : healthData.sleepHours >= 5 
                    ? 'fair' 
                    : 'poor';

            // Map to expected fitData shape for existing risk assessment logic
            const fitData = {
                is_manual: true,
                steps: (healthData.steps || 0) * 7, // Scale to weekly sum to align with division inside calculateHealthMetrics
                calories: dailyCalories * 7, // Scale to weekly sum to align with division
                heartRate: healthData.heartRate || 72,
                distance: (healthData.steps || 0) * 0.00075 * 7, // Scale to weekly sum
                activityLevel: healthData.physicalActivityLevel || 'lightly_active',
                stressLevel: healthData.stressLevel || 'medium',
                sleepQuality: sleepQuality,
                familyHistory: healthData.familyHistory && healthData.familyHistory.length > 0 ? 'yes' : 'no',
                last_sync: new Date().toISOString()
            };

            // Get user profile (include smoker/alcohol details for risk calculation)
            const { data: userInfo, error: userError } = await supabase
                .from('users')
                .select('age, gender, weight, height, smoker, alcohol_consumption')
                .eq('id', userId)
                .single();

            if (userError) {
                console.error('Error fetching user info:', userError);
            }

            // Calculate health metrics using the adapted fitData
            const healthMetrics = this.riskAssessment.calculateHealthMetrics(fitData, userInfo);

            // Generate predictions for all diseases
            const predictions = {};
            const diseases = Object.keys(this.riskAssessment.riskFactors);

            for (const disease of diseases) {
                predictions[disease] = this.riskAssessment.calculateRiskScore(disease, healthMetrics);
            }

            // Generate recommendations
            const recommendations = this.riskAssessment.generateRecommendations(predictions, healthMetrics);

            // Calculate overall health score
            const overallHealthScore = this.calculateOverallHealthScore(predictions, healthMetrics);

            // Segment user risk by combining prediction profile and local outbreak exposure
            const nearbyOutbreakInfo = await this.getNearbyOutbreakCount(userId);
            const riskSegmentData = this.deriveRiskSegment(
                predictions,
                overallHealthScore,
                nearbyOutbreakInfo.count
            );

            const storedSegment = await this.storeRiskSegment(userId, riskSegmentData);
            const expertMonitoring = await this.upsertExpertMonitoringCase(
                userId,
                riskSegmentData,
                predictions,
                nearbyOutbreakInfo.outbreaks
            );

            // Store predictions
            await this.storePredictions(
                userId,
                predictions,
                healthMetrics,
                overallHealthScore,
                recommendations,
                riskSegmentData,
                expertMonitoring
            );

            return {
                predictions,
                healthMetrics,
                recommendations,
                overallHealthScore,
                riskSegment: storedSegment || riskSegmentData,
                expertMonitoring,
                lastUpdated: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error generating predictions:', error);
            throw error;
        }
    }

    // Calculate overall health score
    calculateOverallHealthScore(predictions, healthMetrics) {
        let totalScore = 0;
        let maxScore = 0;

        // Weight different health aspects
        const weights = {
            cardiovascular: 0.25,
            metabolic: 0.25,
            physical: 0.2,
            mental: 0.15,
            lifestyle: 0.15
        };

        // Cardiovascular health
        const cardioScore = 1 - predictions.cardiovascular_disease.probability;
        totalScore += cardioScore * weights.cardiovascular;
        maxScore += weights.cardiovascular;

        // Metabolic health
        const metabolicScore = 1 - (predictions.type_2_diabetes.probability + predictions.obesity.probability) / 2;
        totalScore += metabolicScore * weights.metabolic;
        maxScore += weights.metabolic;

        // Physical health
        const activityScore = healthMetrics.activityLevel === 'very_active' ? 1 :
                             healthMetrics.activityLevel === 'moderately_active' ? 0.8 :
                             healthMetrics.activityLevel === 'lightly_active' ? 0.6 : 0.3;
        totalScore += activityScore * weights.physical;
        maxScore += weights.physical;

        // Mental health
        const mentalScore = 1 - predictions.depression.probability;
        totalScore += mentalScore * weights.mental;
        maxScore += weights.mental;

        // Lifestyle factors
        const lifestyleScore = (1 - healthMetrics.stressLevel) * 0.7 + 
                              (healthMetrics.sleepQuality === 'good' ? 1 : 
                               healthMetrics.sleepQuality === 'fair' ? 0.6 : 0.3) * 0.3;
        totalScore += lifestyleScore * weights.lifestyle;
        maxScore += weights.lifestyle;

        return Math.round((totalScore / maxScore) * 100);
    }

    // Store predictions in database
    async storePredictions(userId, predictions, healthMetrics, overallHealthScore, recommendations, riskSegmentData, expertMonitoring) {
        try {
            const { error } = await supabase
                .from('disease_predictions')
                .upsert({
                    user_id: userId,
                    predictions: predictions,
                    health_metrics: healthMetrics,
                    overall_health_score: overallHealthScore,
                    recommendations: recommendations,
                    risk_segment: riskSegmentData,
                    expert_monitoring: expertMonitoring,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id'
                });

            if (error) {
                console.error('Error storing predictions:', error);
                throw error;
            }
        } catch (error) {
            console.error('Error in storePredictions:', error);
            throw error;
        }
    }

    // Get user's predictions
    async getUserPredictions(userId) {
        try {
            const { data, error } = await supabase
                .from('disease_predictions')
                .select('*')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) {
                console.error('Error fetching predictions:', error);
                return null;
            }

            if (!data) {
                return null;
            }

            return {
                predictions: data.predictions,
                healthMetrics: data.health_metrics,
                recommendations: data.recommendations || [],
                overallHealthScore: data.overall_health_score,
                riskSegment: data.risk_segment || null,
                expertMonitoring: data.expert_monitoring || null,
                lastUpdated: data.updated_at
            };
        } catch (error) {
            console.error('Error in getUserPredictions:', error);
            return null;
        }
    }
}

module.exports = {
    EnhancedPredictionService,
    HealthRiskAssessment
}; 