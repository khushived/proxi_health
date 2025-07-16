# ProxiHealth - Disease Monitoring & Health Prediction App

A comprehensive health monitoring application that tracks disease outbreaks in Kerala and provides personalized health predictions using Google Fit data.

## Features

### 🔐 User Authentication & Security
- **Secure Registration/Login**: Email-based user accounts with password hashing
- **JWT Token Authentication**: Secure session management with JSON Web Tokens
- **Protected Routes**: All sensitive endpoints require authentication
- **Password Validation**: Strong password requirements with validation
- **Email Verification**: Email format validation and uniqueness checking

### 🏥 Disease Outbreak Monitoring
- **Real-time Disease Scraping**: Automatically scrapes disease data from reliable sources every 5 hours
- **Location-based Alerts**: Sends alerts to users when disease outbreaks are detected in their area
- **Kerala District Coverage**: Monitors all 14 districts of Kerala with precise coordinates
- **Multiple Data Sources**: Integrates WHO, Kerala Health Department, and news sources
- **Real-time Notifications**: Instant alerts when outbreaks are detected near user's location

### 📊 Enhanced Health Predictions
- **Advanced ML Models**: Multi-factor risk assessment with weighted algorithms
- **Google Fit Integration**: Connects to Google Fit API using user's email verification
- **Comprehensive Health Analysis**: Analyzes age, BMI, activity level, heart rate, stress, and more
- **Multiple Disease Types**: Cardiovascular, diabetes, obesity, hypertension, depression, respiratory diseases
- **Personalized Recommendations**: Actionable recommendations with timelines
- **Overall Health Score**: 0-100 health score based on multiple factors

### 🔔 Smart Alerts & Dashboard
- **Proximity-based Notifications**: Alerts users within 50km of disease outbreaks
- **Real-time Updates**: Continuous monitoring with automatic alert generation
- **Modern UI**: Beautiful, responsive dashboard with tabbed navigation
- **Profile Management**: User profile with health metrics and preferences

## Tech Stack

### Backend
- **Node.js** with Express.js
- **Supabase** for database and authentication
- **Google Fit API** for health data
- **Axios & Cheerio** for web scraping
- **Node-cron** for scheduled tasks

### Frontend
- **React.js** with modern hooks
- **Tailwind CSS** for styling
- **Responsive Design** for mobile and desktop

### Database
- **PostgreSQL** (via Supabase)
- **Row Level Security** for data protection
- **JSONB** for flexible data storage

## Prerequisites

Before running this application, you'll need:

1. **Node.js** (v16 or higher)
2. **Supabase Account** with a project
3. **Google Cloud Console** project with Google Fit API enabled
4. **News API** key (optional, for news scraping)

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

# Google Fit API Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/callback.html

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_in_production

# News API (Optional)
NEWS_API_KEY=your_news_api_key

# Server Configuration
PORT=3001
```

### 4. Database Setup

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run the contents of `backend/supabase_schema.sql`

### 5. Google Fit API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Fit API
4. Create OAuth 2.0 credentials
5. Add `http://localhost:3000/callback.html` to authorized redirect URIs
6. Copy Client ID and Client Secret to your `.env` file

### 6. Frontend Setup

```bash
cd frontend
npm install
```

### 7. Start the Application

#### Backend
```bash
cd backend
npm start
```

#### Frontend
```bash
cd frontend
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## API Endpoints

### Authentication (Public)
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - User login

### Authentication (Protected)
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Health Records (Protected)
- `GET /api/health-records` - Fetch user's health records
- `POST /api/health-records` - Store new health record

### Disease Outbreaks (Public)
- `GET /api/disease-outbreaks` - Get current disease outbreaks
- `POST /api/disease-scraping` - Manually trigger disease scraping

### User Alerts (Protected)
- `GET /api/user-alerts` - Get alerts for authenticated user

### Google Fit Integration (Protected)
- `GET /api/google-fit/auth` - Get Google Fit authorization URL
- `POST /api/google-fit/callback` - Handle OAuth callback
- `GET /api/google-fit/connection` - Check connection status
- `POST /api/google-fit/sync` - Sync Google Fit data

### Disease Predictions (Protected)
- `POST /api/disease-prediction` - Generate new predictions
- `GET /api/disease-prediction` - Get existing predictions

## Database Schema

### Core Tables
- `users` - User information and demographics
- `health_records` - Location and health data
- `disease_outbreaks` - Current disease outbreaks
- `user_alerts` - User-specific health alerts
- `google_fit_data` - Google Fit health metrics
- `user_tokens` - OAuth tokens for API access
- `disease_predictions` - ML-generated health predictions

## Features in Detail

### Disease Scraping System

The application automatically scrapes disease data from multiple sources:

1. **WHO Disease Outbreak News** - Official health alerts
2. **Kerala Health Department** - Local health data
3. **News API** - Recent health-related news

Data is updated every 5 hours and stored in the `disease_outbreaks` table.

### Location-based Alert System

When a user's location is detected near a disease outbreak:
1. Distance is calculated using Haversine formula
2. Alerts are generated for outbreaks within 50km
3. Notifications are stored in `user_alerts` table
4. Real-time alerts appear in the dashboard

### Health Prediction Engine

The ML-based prediction system analyzes:

**Health Metrics:**
- Daily step count
- Average heart rate
- Calorie burn
- Activity level
- BMI (if available)

**Predicted Risks:**
- Cardiovascular disease
- Type 2 diabetes
- Obesity
- Hypertension
- Depression

**Recommendations:**
- Personalized health advice
- Activity suggestions
- Medical consultation reminders

## Security Features

- **Row Level Security** (RLS) in Supabase
- **OAuth 2.0** for Google Fit integration
- **Environment variables** for sensitive data
- **CORS protection** for API endpoints
- **Input validation** on all endpoints

## Monitoring and Maintenance

### Scheduled Tasks
- Disease scraping runs every 5 hours
- Data cleanup removes old records
- Health metrics are recalculated daily

### Error Handling
- Comprehensive error logging
- Graceful failure handling
- User-friendly error messages

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## Disclaimer

This application is for educational and informational purposes only. It should not be used as a substitute for professional medical advice, diagnosis, or treatment. Always consult with qualified healthcare providers for medical concerns.

The disease prediction features are based on general health metrics and should not be considered as medical diagnoses. The accuracy of predictions depends on the quality and completeness of the input data. 