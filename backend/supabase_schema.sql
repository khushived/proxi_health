-- ProxiHealth Database Schema for Supabase

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (basic user information)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'doctor')),
    age INTEGER,
    gender VARCHAR(50),
    weight DECIMAL(5,2), -- in kg
    height DECIMAL(5,2), -- in cm
    smoker VARCHAR(50),
    alcohol_consumption VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Health records table (existing)
CREATE TABLE IF NOT EXISTS health_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location_data JSONB,
    google_fit_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disease outbreaks table (new)
CREATE TABLE IF NOT EXISTS disease_outbreaks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    disease_name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    district VARCHAR(255) NOT NULL,
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    cases INTEGER DEFAULT 0,
    source VARCHAR(255) NOT NULL,
    coordinates JSONB, -- {lat: number, lng: number}
    news_title VARCHAR(500),
    news_url TEXT,
    precautions JSONB DEFAULT '[]'::jsonb,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Doctor profile details
CREATE TABLE IF NOT EXISTS doctor_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    specialty VARCHAR(255),
    license_number VARCHAR(255),
    clinic_name VARCHAR(255),
    consultation_mode VARCHAR(100) DEFAULT 'hybrid',
    bio TEXT,
    years_of_experience INTEGER DEFAULT 0,
    verification_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Link doctors to patients they can review
CREATE TABLE IF NOT EXISTS patient_doctor_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (doctor_id, patient_id)
);

-- Prescriptions and medicines shared by doctors
CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    medicine_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(255),
    frequency VARCHAR(255),
    duration_days INTEGER,
    instructions TEXT,
    prescribed_for VARCHAR(255),
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User alerts table (new)
CREATE TABLE IF NOT EXISTS user_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_type VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    outbreak_data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Google Fit data table (new)
CREATE TABLE IF NOT EXISTS google_fit_data (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    steps INTEGER DEFAULT 0,
    calories DECIMAL(10,2) DEFAULT 0,
    heart_rate_data JSONB, -- Array of heart rate readings
    distance DECIMAL(10,2) DEFAULT 0,
    activities JSONB,
    last_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User tokens table (for OAuth tokens)
CREATE TABLE IF NOT EXISTS user_tokens (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    google_fit_access_token TEXT,
    google_fit_refresh_token TEXT,
    google_email VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disease predictions table (new)
CREATE TABLE IF NOT EXISTS disease_predictions (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    predictions JSONB NOT NULL, -- Disease risk predictions
    health_metrics JSONB NOT NULL, -- Calculated health metrics
    overall_health_score INTEGER, -- Overall health score (0-100)
    recommendations JSONB DEFAULT '[]'::jsonb,
    risk_segment JSONB,
    expert_monitoring JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Long-horizon future disease predictions
CREATE TABLE IF NOT EXISTS future_disease_predictions (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    predictions JSONB NOT NULL,
    health_metrics JSONB NOT NULL,
    overall_health_score INTEGER,
    recommendations JSONB DEFAULT '[]'::jsonb,
    risk_segment JSONB,
    expert_monitoring JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User risk segmentation table
CREATE TABLE IF NOT EXISTS user_segments (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    segment VARCHAR(50) NOT NULL CHECK (segment IN ('low_risk', 'moderate_risk', 'high_risk', 'critical_risk')),
    segment_details JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expert monitoring escalation cases
CREATE TABLE IF NOT EXISTS expert_monitoring_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('open', 'in_review', 'resolved')) DEFAULT 'open',
    escalation_level VARCHAR(50) NOT NULL CHECK (escalation_level IN ('watch', 'priority', 'urgent')) DEFAULT 'watch',
    summary TEXT NOT NULL,
    case_context JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_health_records_user_id ON health_records(user_id);
CREATE INDEX IF NOT EXISTS idx_health_records_created_at ON health_records(created_at);
CREATE INDEX IF NOT EXISTS idx_disease_outbreaks_location ON disease_outbreaks(location);
CREATE INDEX IF NOT EXISTS idx_disease_outbreaks_last_updated ON disease_outbreaks(last_updated);
CREATE INDEX IF NOT EXISTS idx_user_alerts_user_id ON user_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_alerts_created_at ON user_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_user_alerts_is_read ON user_alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_user_segments_segment ON user_segments(segment);
CREATE INDEX IF NOT EXISTS idx_expert_monitoring_cases_status ON expert_monitoring_cases(status);
CREATE INDEX IF NOT EXISTS idx_expert_monitoring_cases_updated_at ON expert_monitoring_cases(updated_at);
CREATE INDEX IF NOT EXISTS idx_future_disease_predictions_user_id ON future_disease_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_verification_status ON doctor_profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_patient_doctor_assignments_doctor_id ON patient_doctor_assignments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_patient_doctor_assignments_patient_id ON patient_doctor_assignments(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_id ON prescriptions(doctor_id);

-- Create RLS (Row Level Security) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE disease_outbreaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_fit_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE disease_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE future_disease_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_monitoring_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_doctor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

-- Policy for health_records (users can only see their own records)
CREATE POLICY "Users can view own health records" ON health_records
    FOR SELECT USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can insert own health records" ON health_records
    FOR INSERT WITH CHECK (user_id::text = auth.uid()::text);

-- Policy for user_alerts (users can only see their own alerts)
CREATE POLICY "Users can view own alerts" ON user_alerts
    FOR SELECT USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can insert own alerts" ON user_alerts
    FOR INSERT WITH CHECK (user_id::text = auth.uid()::text);

-- Policy for google_fit_data (users can only see their own data)
CREATE POLICY "Users can view own Google Fit data" ON google_fit_data
    FOR SELECT USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can insert/update own Google Fit data" ON google_fit_data
    FOR ALL USING (user_id::text = auth.uid()::text);

-- Policy for user_tokens (users can only see their own tokens)
CREATE POLICY "Users can view own tokens" ON user_tokens
    FOR SELECT USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can insert/update own tokens" ON user_tokens
    FOR ALL USING (user_id::text = auth.uid()::text);

-- Policy for disease_predictions (users can only see their own predictions)
CREATE POLICY "Users can view own predictions" ON disease_predictions
    FOR SELECT USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can insert/update own predictions" ON disease_predictions
    FOR ALL USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can view own future predictions" ON future_disease_predictions
    FOR SELECT USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can insert/update own future predictions" ON future_disease_predictions
    FOR ALL USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can view own segments" ON user_segments
    FOR SELECT USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can manage own segments" ON user_segments
    FOR ALL USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can view own expert cases" ON expert_monitoring_cases
    FOR SELECT USING (user_id::text = auth.uid()::text);

CREATE POLICY "Service role can manage expert cases" ON expert_monitoring_cases
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Doctors can view their profile" ON doctor_profiles
    FOR SELECT USING (user_id::text = auth.uid()::text);

CREATE POLICY "Doctors can manage their profile" ON doctor_profiles
    FOR ALL USING (user_id::text = auth.uid()::text);

CREATE POLICY "Doctors can view their assignments" ON patient_doctor_assignments
    FOR SELECT USING (doctor_id::text = auth.uid()::text OR patient_id::text = auth.uid()::text);

CREATE POLICY "Doctors can manage assignments" ON patient_doctor_assignments
    FOR ALL USING (doctor_id::text = auth.uid()::text);

CREATE POLICY "Patients can view their prescriptions" ON prescriptions
    FOR SELECT USING (patient_id::text = auth.uid()::text OR doctor_id::text = auth.uid()::text);

CREATE POLICY "Doctors can manage prescriptions" ON prescriptions
    FOR ALL USING (doctor_id::text = auth.uid()::text);

-- Disease outbreaks are public (read-only for all users)
CREATE POLICY "Anyone can view disease outbreaks" ON disease_outbreaks
    FOR SELECT USING (true);

-- Only service role can insert/update disease outbreaks
CREATE POLICY "Service role can manage disease outbreaks" ON disease_outbreaks
    FOR ALL USING (auth.role() = 'service_role');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_health_records_updated_at BEFORE UPDATE ON health_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_google_fit_data_updated_at BEFORE UPDATE ON google_fit_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_tokens_updated_at BEFORE UPDATE ON user_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_disease_predictions_updated_at BEFORE UPDATE ON disease_predictions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_future_disease_predictions_updated_at BEFORE UPDATE ON future_disease_predictions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_segments_updated_at BEFORE UPDATE ON user_segments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expert_monitoring_cases_updated_at BEFORE UPDATE ON expert_monitoring_cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_doctor_profiles_updated_at BEFORE UPDATE ON doctor_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patient_doctor_assignments_updated_at BEFORE UPDATE ON patient_doctor_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON prescriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample disease outbreaks for testing
INSERT INTO disease_outbreaks (disease_name, location, district, severity, cases, source, coordinates) VALUES
('Dengue Fever', 'Kerala', 'Thiruvananthapuram', 'high', 25, 'WHO', '{"lat": 8.5241, "lng": 76.9366}'),
('Malaria', 'Kerala', 'Kozhikode', 'medium', 15, 'WHO', '{"lat": 11.2588, "lng": 75.7804}'),
('COVID-19', 'Kerala', 'Ernakulam', 'medium', 45, 'Kerala Health Department', '{"lat": 10.0168, "lng": 76.3078}'),
('Chikungunya', 'Kerala', 'Alappuzha', 'high', 30, 'Kerala Health Department', '{"lat": 9.4981, "lng": 76.3388}')
ON CONFLICT DO NOTHING;

-- Migration to add smoker and alcohol_consumption columns for existing tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS smoker VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS alcohol_consumption VARCHAR(50);
ALTER TABLE disease_outbreaks ADD COLUMN IF NOT EXISTS precautions JSONB DEFAULT '[]'::jsonb;

 