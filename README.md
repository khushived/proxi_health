# ProxiHealth - Disease Monitoring & Health Prediction App

A comprehensive health monitoring application that tracks disease outbreaks in Kerala, manages doctor-patient relationships, and provides personalized health predictions based on user-submitted Health Assessment data.

## Features

### 🔐 User Authentication & Security
- **Secure Registration/Login**: Email-based user accounts with password hashing (Supabase integration)
- **Protected Access**: All medical telemetry and analysis endpoints require active session authentication
- **Password Validation**: Validation of password strength on registration
- **Account Profiles**: Supports customized Patient and Doctor account roles

### 🩺 Doctor Directory & Console
- **Doctor Profiles & Specialties**: Profiles detailing doctor specialties, clinic names, bios, and experience
- **Patient Directory Management**: Doctors can assign patients to their directories using shared UUIDs
- **Clinical Folder Lookup**: View patient demographics, vital health assessment telemetry, and risk metrics
- **Medication Prescriptions**: Doctors can issue and track prescriptions directly from the patient console

### 🏥 Disease Outbreak Monitoring
- **Real-time Disease Scraping**: Automatically scrapes regional disease data from reliable official sources
- **Location-based Alerts**: Sends proximity alerts to users when disease outbreaks are detected in their area
- **Kerala District Coverage**: Monitors all 14 districts of Kerala with precise coordinates
- **Multiple Data Sources**: Integrates WHO, Kerala Health Department, and news sources
- **Real-time Notifications**: Alert logs displayed directly on the dashboard when outbreaks are detected within 50km

### 📊 AI Health Predictions
- **Multi-Factor Risk Models**: Risk evaluation algorithms mapping age, BMI, heart rate, sleep quality, and lifestyle factors
- **Manual Health Assessment**: Simple form capturing steps, resting heart rate, deep sleep hours, stress, and medical history
- **Multiple Disease Risks**: Cardiovascular, type 2 diabetes, obesity, hypertension, depression, and respiratory conditions
- **Personalized Recommendations**: Timely recommendations based on calculation outcomes
- **Overall Health Score**: An overall health score graded from 0 to 100

---

## Tech Stack

### Backend
- **Node.js** with Express.js
- **Supabase** for database management and security rules
- **Cheerio** for web scraping
- **Node-cron** for scheduled automated tasks

### Frontend
- **React.js** with modern hooks
- **Tailwind CSS** for layout styling
- **Recharts** for visualizing health trend lines

### Database
- **PostgreSQL** (hosted via Supabase)
- **Row Level Security** (RLS) policies for patient confidentiality

---

## Prerequisites

Before running this application, you'll need:

1. **Node.js** (v16 or higher)
2. **Supabase Account** with a running project
3. **News API** key (optional, for scraping health articles)

---

## Setup Instructions

### 1. Clone the Repository
```bash
git clone <repository-url>
cd proxihealth
```

### 2. Backend Setup
```bash
cd backend
npm install
```

### 3. Environment Configuration
Create a `.env` file in the `backend` directory:
```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# News API (Optional)
NEWS_API_KEY=your_news_api_key

# Server Configuration
PORT=3001
CORS_ORIGINS=http://localhost:3002
```

### 4. Database Setup
1. Go to your Supabase project dashboard.
2. Navigate to the SQL Editor.
3. Run the contents of `backend/supabase_schema.sql` and `backend/migration_add_health_data.sql`.

### 5. Frontend Setup
```bash
cd ../frontend
npm install
```

### 6. Run the App
#### Start Backend
```bash
cd backend
npm start
```

#### Start Frontend
```bash
cd frontend
npm start
```
- Frontend will be available at: http://localhost:3002
- Backend API will be available at: http://localhost:3001

---

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a user (Patient/Doctor)
- `POST /api/auth/login` - Authenticate user credentials

### User & Health Profiles
- `GET /api/auth/profile` - Retrieve user profile details
- `PUT /api/auth/profile` - Update user demographics
- `GET /api/health-data` - Fetch user's manual Health Assessment data
- `POST /api/health-data` - Save/update manual Health Assessment data
- `GET /api/health-data/status` - Check if the user has completed their Health Assessment

### Doctor Directory (Protected)
- `GET /api/doctor/patients` - Fetch patient lists assigned to the doctor
- `GET /api/doctor/patients/:patientId` - Fetch clinical summary of a specific patient
- `POST /api/doctor/patients/:patientId/prescriptions` - Issue a prescription to a patient
- `POST /api/doctor/patients/:patientId/assign` - Link a patient to the doctor directory

### Disease Outbreaks & Predictions
- `GET /api/disease-outbreaks` - Get current disease outbreaks
- `POST /api/disease-prediction` - Generate disease predictions for the user
- `GET /api/future-disease-risk` - Project disease risks 10 years into the future
- `GET /api/risk-segmentation` - Get latest user risk segment details

---

## Database Schema

### Core Tables
- `users` - User registration credentials, roles, age, weight, height, and smoking/drinking habits
- `user_health_data` - Health Assessment metrics submitted by patients
- `disease_outbreaks` - Region outbreaks gathered by crawler tasks
- `user_alerts` - Alerts pushed to patients based on geolocation proximity
- `prescriptions` - Doctor-issued medicine names, dosages, frequencies, and instructions
- `patient_doctor_assignments` - Directory maps pairing patients with consulting doctors
- `disease_predictions` - ML-generated risk evaluation records

---

## Disclaimer

This application is for educational and informational purposes only. It should not be used as a substitute for professional medical advice, diagnosis, or treatment. Always consult with qualified healthcare providers for medical concerns.