-- ProxiHealth Database Schema for Supabase

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (basic user information)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    age INTEGER,
    gender VARCHAR(50),
    weight DECIMAL(5,2), -- in kg
    height DECIMAL(5,2), -- in cm
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Health records table (existing)
CREATE TABLE IF NOT EXISTS health_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
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
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User alerts table (new)
CREATE TABLE IF NOT EXISTS user_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    alert_type VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    outbreak_data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Google Fit data table (new)
CREATE TABLE IF NOT EXISTS google_fit_data (
    user_id VARCHAR(255) PRIMARY KEY,
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
    user_id VARCHAR(255) PRIMARY KEY,
    google_fit_access_token TEXT,
    google_fit_refresh_token TEXT,
    google_email VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disease predictions table (new)
CREATE TABLE IF NOT EXISTS disease_predictions (
    user_id VARCHAR(255) PRIMARY KEY,
    predictions JSONB NOT NULL, -- Disease risk predictions
    health_metrics JSONB NOT NULL, -- Calculated health metrics
    overall_health_score INTEGER, -- Overall health score (0-100)
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

-- Create RLS (Row Level Security) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE disease_outbreaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_fit_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE disease_predictions ENABLE ROW LEVEL SECURITY;

-- Policy for health_records (users can only see their own records)
CREATE POLICY "Users can view own health records" ON health_records
    FOR SELECT USING (user_id = current_user);

CREATE POLICY "Users can insert own health records" ON health_records
    FOR INSERT WITH CHECK (user_id = current_user);

-- Policy for user_alerts (users can only see their own alerts)
CREATE POLICY "Users can view own alerts" ON user_alerts
    FOR SELECT USING (user_id = current_user);

CREATE POLICY "Users can insert own alerts" ON user_alerts
    FOR INSERT WITH CHECK (user_id = current_user);

-- Policy for google_fit_data (users can only see their own data)
CREATE POLICY "Users can view own Google Fit data" ON google_fit_data
    FOR SELECT USING (user_id = current_user);

CREATE POLICY "Users can insert/update own Google Fit data" ON google_fit_data
    FOR ALL USING (user_id = current_user);

-- Policy for user_tokens (users can only see their own tokens)
CREATE POLICY "Users can view own tokens" ON user_tokens
    FOR SELECT USING (user_id = current_user);

CREATE POLICY "Users can insert/update own tokens" ON user_tokens
    FOR ALL USING (user_id = current_user);

-- Policy for disease_predictions (users can only see their own predictions)
CREATE POLICY "Users can view own predictions" ON disease_predictions
    FOR SELECT USING (user_id = current_user);

CREATE POLICY "Users can insert/update own predictions" ON disease_predictions
    FOR ALL USING (user_id = current_user);

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

-- Insert some sample disease outbreaks for testing
INSERT INTO disease_outbreaks (disease_name, location, district, severity, cases, source, coordinates) VALUES
('Dengue Fever', 'Kerala', 'Thiruvananthapuram', 'high', 25, 'WHO', '{"lat": 8.5241, "lng": 76.9366}'),
('Malaria', 'Kerala', 'Kozhikode', 'medium', 15, 'WHO', '{"lat": 11.2588, "lng": 75.7804}'),
('COVID-19', 'Kerala', 'Ernakulam', 'medium', 45, 'Kerala Health Department', '{"lat": 10.0168, "lng": 76.3078}'),
('Chikungunya', 'Kerala', 'Alappuzha', 'high', 30, 'Kerala Health Department', '{"lat": 9.4981, "lng": 76.3388}')
ON CONFLICT DO NOTHING; 