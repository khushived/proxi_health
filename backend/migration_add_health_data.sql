-- Add user_health_data table for manually entered health metrics
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_health_data (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    daily_steps INTEGER DEFAULT 0,
    resting_heart_rate INTEGER DEFAULT 72,
    sleep_hours DECIMAL(4,1) DEFAULT 7.0,
    deep_sleep_hours DECIMAL(4,1) DEFAULT 1.5,
    stress_level VARCHAR(20) DEFAULT 'medium' CHECK (stress_level IN ('low', 'medium', 'high')),
    physical_activity_level VARCHAR(30) DEFAULT 'lightly_active' CHECK (physical_activity_level IN ('sedentary', 'lightly_active', 'moderately_active', 'very_active')),
    weekly_exercise_hours DECIMAL(5,1) DEFAULT 0,
    chronic_conditions JSONB DEFAULT '[]'::jsonb,
    family_history JSONB DEFAULT '[]'::jsonb,
    current_symptoms JSONB DEFAULT '[]'::jsonb,
    diet_quality VARCHAR(20) DEFAULT 'fair' CHECK (diet_quality IN ('poor', 'fair', 'good', 'excellent')),
    water_intake_liters DECIMAL(4,1) DEFAULT 2.0,
    blood_oxygen_level DECIMAL(5,2) DEFAULT 98.0,
    last_checkup_months INTEGER DEFAULT 12,
    on_medication BOOLEAN DEFAULT FALSE,
    medication_details TEXT,
    snoring BOOLEAN DEFAULT FALSE,
    wakeups_per_night INTEGER DEFAULT 1,
    mood VARCHAR(20) DEFAULT 'neutral' CHECK (mood IN ('very_low', 'low', 'neutral', 'good', 'excellent')),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE user_health_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own health data" ON user_health_data
    FOR ALL USING (user_id::text = auth.uid()::text);

CREATE POLICY "Service role can manage health data" ON user_health_data
    FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_user_health_data_user_id ON user_health_data(user_id);
CREATE INDEX IF NOT EXISTS idx_user_health_data_updated_at ON user_health_data(updated_at);
ALTER TABLE user_tokens ADD COLUMN IF NOT EXISTS google_health_access_token TEXT;
ALTER TABLE user_tokens ADD COLUMN IF NOT EXISTS google_health_refresh_token TEXT;
