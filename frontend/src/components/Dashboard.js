import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, formatDistanceToNow } from 'date-fns';
import HealthQuestionnaire from './HealthQuestionnaire';
import { API_BASE_URL } from '../config';


const Dashboard = ({ user, onLogout }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [currentLocation, setCurrentLocation] = useState(null);
    const [diseaseOutbreaks, setDiseaseOutbreaks] = useState([]);
    const [userAlerts, setUserAlerts] = useState([]);
    const [diseasePredictions, setDiseasePredictions] = useState(null);
    const [futureDiseaseRisk, setFutureDiseaseRisk] = useState(null);
    const [riskSegment, setRiskSegment] = useState(null);
    const [expertCases, setExpertCases] = useState([]);
    const [doctorPatients, setDoctorPatients] = useState([]);
    const [doctorPatientId, setDoctorPatientId] = useState('');
    const [prescriptions, setPrescriptions] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [newPrescription, setNewPrescription] = useState({ medicineName: '', dosage: '', frequency: '', durationDays: '', instructions: '' });

    const [healthAssessmentStatus, setHealthAssessmentStatus] = useState({ connected: false });
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [currentTime, setCurrentTime] = useState(new Date());

    // Patient's doctors state
    const [patientDoctors, setPatientDoctors] = useState([]);
    const [connectDoctorEmail, setConnectDoctorEmail] = useState('');

    const showMessage = (text, type = 'info') => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), 5000);
    };

    // Update current time every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const normalizePredictionPayload = (payload) => {
        if (!payload) return null;
        return {
            predictions: payload.predictions || {},
            healthMetrics: payload.healthMetrics || payload.health_metrics || {},
            recommendations: payload.recommendations || [],
            overallHealthScore: payload.overallHealthScore ?? payload.overall_health_score ?? null,
            riskSegment: payload.riskSegment || payload.risk_segment || null,
            expertMonitoring: payload.expertMonitoring || payload.expert_monitoring || null,
            lastUpdated: payload.lastUpdated || payload.updated_at || null
        };
    };



    // Load initial data based on role
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                await Promise.all([
                    fetchDiseaseOutbreaks(),
                    fetchUserAlerts(),
                    checkHealthAssessmentStatus(),
                    fetchDiseasePredictions(),
                    fetchFutureDiseaseRisk(),
                    fetchRiskSegmentation(),
                    fetchExpertMonitoringCases(),
                    fetchPrescriptions()
                ]);

                if (user?.role === 'doctor') {
                    await fetchDoctorPatients();
                } else {
                    await fetchPatientDoctors();
                }
            } catch (error) {
                console.error('Error fetching initial data:', error);
            }
        };

        loadInitialData();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchDiseaseOutbreaks = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/disease-outbreaks`);
            if (response.ok) {
                const data = await response.json();
                setDiseaseOutbreaks(data);
            }
        } catch (error) {
            console.error('Error fetching outbreaks:', error);
        }
    };

    const fetchUserAlerts = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/user-alerts`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (response.ok) {
                const data = await response.json();
                setUserAlerts(data);
            }
        } catch (error) {
            console.error('Error fetching alerts:', error);
        }
    };

    const checkHealthAssessmentStatus = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/health-data/status`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (response.ok) {
                const data = await response.json();
                setHealthAssessmentStatus(data);
            }
        } catch (error) {
            console.error('Error checking Health Assessment status:', error);
        }
    };

    const fetchDiseasePredictions = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/disease-prediction`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (response.ok) {
                const data = await response.json();
                const normalized = normalizePredictionPayload(data);
                setDiseasePredictions(normalized);
                if (normalized?.riskSegment) {
                    setRiskSegment(normalized.riskSegment);
                }
            }
        } catch (error) {
            console.error('Error fetching predictions:', error);
        }
    };

    const fetchFutureDiseaseRisk = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/future-disease-risk`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (response.ok) {
                const data = await response.json();
                setFutureDiseaseRisk(data);
            }
        } catch (error) {
            console.error('Error fetching future disease risk:', error);
        }
    };

    const fetchRiskSegmentation = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/risk-segmentation`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (response.ok) {
                const data = await response.json();
                setRiskSegment(data);
            }
        } catch (error) {
            console.error('Error fetching risk segmentation:', error);
        }
    };

    const fetchExpertMonitoringCases = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/expert-monitoring`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (response.ok) {
                const data = await response.json();
                setExpertCases(data || []);
            }
        } catch (error) {
            console.error('Error fetching expert monitoring cases:', error);
        }
    };

    const fetchDoctorPatients = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/doctor/patients`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (response.ok) {
                const data = await response.json();
                setDoctorPatients(data || []);
            }
        } catch (error) {
            console.error('Error fetching doctor patients:', error);
        }
    };

    const fetchPatientDoctors = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/patient/doctors`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (response.ok) {
                const data = await response.json();
                setPatientDoctors(data || []);
            }
        } catch (error) {
            console.error('Error fetching patient doctors:', error);
        }
    };

    const fetchPrescriptions = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/prescriptions`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (response.ok) {
                const data = await response.json();
                setPrescriptions(data || []);
            }
        } catch (error) {
            console.error('Error fetching prescriptions:', error);
        }
    };

    const handleConnectDoctor = async (e) => {
        e.preventDefault();
        if (!connectDoctorEmail.trim()) {
            showMessage('Please enter a doctor email address', 'error');
            return;
        }
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/patient/doctors/connect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ doctorEmail: connectDoctorEmail })
            });
            
            if (response.ok) {
                const result = await response.json();
                showMessage(result.message, 'success');
                setConnectDoctorEmail('');
                await fetchPatientDoctors();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to connect to doctor');
            }
        } catch (error) {
            showMessage(error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const assignPatientToDoctor = async () => {
        if (!doctorPatientId.trim()) {
            showMessage('Enter a patient ID to assign', 'error');
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/doctor/patients/${doctorPatientId}/assign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ notes: 'Assigned from doctor dashboard' })
            });

            if (response.ok) {
                showMessage('Patient assigned successfully', 'success');
                setDoctorPatientId('');
                fetchDoctorPatients();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to assign patient');
            }
        } catch (error) {
            showMessage(error.message, 'error');
        }
    };

    const handleAddPrescription = async (e) => {
        e.preventDefault();
        if (!selectedPatient) return;
        if (!newPrescription.medicineName.trim()) {
            showMessage('Medicine name is required', 'error');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/doctor/patients/${selectedPatient.patient.id}/prescriptions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(newPrescription)
            });

            if (response.ok) {
                showMessage('Prescription created successfully!', 'success');
                setNewPrescription({ medicineName: '', dosage: '', frequency: '', durationDays: '', instructions: '' });
                await fetchDoctorPatients();
                
                const updatedList = await fetch(`${API_BASE_URL}/doctor/patients`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (updatedList.ok) {
                    const data = await updatedList.json();
                    setDoctorPatients(data || []);
                    const updatedPatient = data.find(p => p.patient.id === selectedPatient.patient.id);
                    if (updatedPatient) setSelectedPatient(updatedPatient);
                }
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create prescription');
            }
        } catch (error) {
            showMessage(error.message, 'error');
        }
    };

    // Location triggers
    const handleGetLocation = () => {
        if (navigator.geolocation) {
            showMessage("Locating your coordinates...", 'info');
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: new Date().toISOString()
                    };
                    setCurrentLocation(location);
                    showMessage("Location synced!", 'success');
                    checkLocationAlerts(location);
                },
                (error) => {
                    showMessage("Failed to get location. Please permit GPS access.", 'error');
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            showMessage("Geolocation is not supported by your browser.", 'error');
        }
    };

    const checkLocationAlerts = async (location) => {
        try {
            const response = await fetch(`${API_BASE_URL}/health-records`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ locationData: location })
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.alerts && result.alerts.length > 0) {
                    showMessage(`Health Alert: ${result.alerts.length} disease outbreak(s) detected near your area!`, 'warning');
                    fetchUserAlerts();
                }
            }
        } catch (error) {
            console.error('Error checking location alerts:', error);
        }
    };


    const handleGeneratePredictions = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/disease-prediction`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (response.ok) {
                const result = await response.json();
                const normalized = normalizePredictionPayload(result);
                setDiseasePredictions(normalized);
                if (normalized?.riskSegment) {
                    setRiskSegment(normalized.riskSegment);
                }
                // Also refresh future disease risk and risk segmentation
                await fetchFutureDiseaseRisk();
                await fetchRiskSegmentation();
                fetchExpertMonitoringCases();
                showMessage("Predictions refreshed successfully!", 'success');
            } else {
                const errData = await response.json();
                throw new Error(errData.error || 'Prediction generation failed');
            }
        } catch (error) {
            showMessage(error.message || "Error generating predictions", 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        onLogout();
    };

    // Copy to clipboard utility
    const handleCopyUUID = (uuid) => {
        navigator.clipboard.writeText(uuid);
        showMessage("Patient ID copied to clipboard!", "success");
    };

    // Random generators for charts
    const generateWeeklyHealthData = () => {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        return days.map(day => ({
            day,
            steps: Math.floor(Math.random() * 5000) + 3000,
            heartRate: Math.floor(Math.random() * 30) + 60,
            calories: Math.floor(Math.random() * 500) + 1500,
        }));
    };



    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'N/A';
        try {
            return format(new Date(timestamp), 'MMM dd, yyyy HH:mm');
        } catch (e) {
            return 'Invalid date';
        }
    };

    const formatTimeAgo = (timestamp) => {
        if (!timestamp) return 'N/A';
        try {
            return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
        } catch (e) {
            return 'Invalid date';
        }
    };

    return (
        <div className="min-h-screen bg-[#0B0F19] text-gray-100 font-sans relative overflow-hidden pb-12">
            {/* Background blur blobs */}
            <div className="absolute top-[-20%] left-[-15%] w-[60%] h-[50%] rounded-full bg-indigo-600/10 blur-[130px] pointer-events-none"></div>
            <div className="absolute top-[40%] right-[-15%] w-[60%] h-[50%] rounded-full bg-emerald-600/5 blur-[130px] pointer-events-none"></div>

            {/* Header */}
            <header className="bg-[#111625]/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <div className="flex items-center space-x-3">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-white tracking-tight">ProxiHealth</h1>
                                <p className="text-xs text-gray-400">Welcome back, <span className="text-indigo-400 font-semibold">{user?.name}</span> ({user?.role})</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="text-right hidden md:block">
                                <div className="text-xs text-gray-300 font-mono">{format(currentTime, 'HH:mm:ss')}</div>
                                <div className="text-[10px] text-gray-500">{format(currentTime, 'MMM dd, yyyy')}</div>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="bg-white/5 hover:bg-red-500/20 text-gray-300 hover:text-red-400 border border-white/10 rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-200"
                            >
                                Sign out
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Navigation Tabs */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
                <div className="flex space-x-2 bg-[#121824] p-1.5 rounded-2xl border border-white/5 w-fit">
                    {[
                        { id: 'overview', name: 'Overview', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
                        { id: 'outbreaks', name: 'Disease Outbreaks', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z' },
                        { id: 'predictions', name: 'Health Predictions', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
                        ...(user?.role === 'patient' ? [{ id: 'assessment', name: 'Health Assessment', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' }] : []),
                        ...(user?.role === 'doctor' ? [{ id: 'doctor', name: 'Doctor Console', icon: 'M17 20h5v-2a4 4 0 00-4-4h-1m-4 6h-6m6 0V9a4 4 0 10-8 0v11m8 0H7' }] : []),
                        { id: 'profile', name: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-2 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all duration-200 ${
                                activeTab === tab.id
                                    ? 'bg-gradient-to-r from-indigo-500 to-emerald-500 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                            </svg>
                            <span>{tab.name}</span>
                        </button>
                    ))}
                </div>
            </div>



            {/* Messages */}
            {message.text && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
                    <div className={`rounded-xl p-4 border text-xs font-medium flex items-center space-x-2 ${
                        message.type === 'error' ? 'bg-red-500/10 border-red-500/25 text-red-400' :
                        message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' :
                        message.type === 'warning' ? 'bg-amber-500/10 border-amber-500/25 text-amber-400' :
                        'bg-blue-500/10 border-blue-500/25 text-blue-400'
                    }`}>
                        <span>{message.text}</span>
                    </div>
                </div>
            )}
            {/* Main Content Area */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                
                {/* 1. OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        
                        {/* Quick Dashboard Header Actions */}
                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-xl flex flex-wrap gap-4 items-center justify-between">
                            <div>
                                <h2 className="text-xl font-extrabold text-white">Health Command Center</h2>
                                <p className="text-xs text-gray-400 mt-1">Review live telemetry metrics, alert layers, and doctor updates.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={handleGetLocation}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2.5 text-xs font-semibold shadow-lg shadow-indigo-600/15 flex items-center space-x-2"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    </svg>
                                    <span>Sync GPS Location</span>
                                </button>
                                
                                <button
                                    onClick={() => setActiveTab('assessment')}
                                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2.5 text-xs font-semibold shadow-lg shadow-indigo-600/15"
                                >
                                    Edit Health Info
                                </button>

                                <button
                                    onClick={handleGeneratePredictions}
                                    disabled={isLoading}
                                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-4 py-2.5 text-xs font-semibold disabled:opacity-40"
                                >
                                    Analyze Predictions
                                </button>
                            </div>
                        </div>

                        {/* Patient UUID Section */}
                        {user?.role === 'patient' && (
                            <div className="bg-gradient-to-r from-indigo-900/40 to-[#121824] border border-indigo-500/20 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-sm font-bold text-white tracking-wide uppercase">Your Shared Medical UUID</h3>
                                    <p className="text-xs text-gray-400 mt-1">Share this unique ID with your doctor to connect accounts.</p>
                                </div>
                                <div className="flex items-center space-x-2 bg-[#0B0F19] border border-white/10 rounded-xl px-3.5 py-2 w-full md:w-auto font-mono text-xs text-indigo-300">
                                    <span className="truncate max-w-[250px] md:max-w-none">{user.id}</span>
                                    <button 
                                        onClick={() => handleCopyUUID(user.id)}
                                        className="text-gray-400 hover:text-white transition-colors"
                                        title="Copy UUID"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Status Overview Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            
                            {/* GPS Status */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all">
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">GPS Location</h3>
                                {currentLocation ? (
                                    <div className="space-y-1.5 text-xs">
                                        <p className="font-semibold text-white">District: <span className="text-indigo-400">{currentLocation.latitude ? 'Detected' : 'N/A'}</span></p>
                                        <p className="text-gray-400">Lat: {currentLocation.latitude.toFixed(4)}</p>
                                        <p className="text-gray-400">Lng: {currentLocation.longitude.toFixed(4)}</p>
                                        <p className="text-[10px] text-gray-500 pt-2">Updated {formatTimeAgo(currentLocation.timestamp)}</p>
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-500 italic">No GPS coordinates locked</p>
                                )}
                            </div>

                            {/* Assessment Status */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all">
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Assessment Status</h3>
                                {healthAssessmentStatus.connected ? (
                                    <div className="space-y-1.5 text-xs">
                                        <p className="text-emerald-400 font-bold">Submitted</p>
                                        <p className="text-gray-300">Form data active</p>
                                        {healthAssessmentStatus.lastUpdated && (
                                            <p className="text-[10px] text-gray-500 pt-2">Updated {formatTimeAgo(healthAssessmentStatus.lastUpdated)}</p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-500 italic">No health assessment found</p>
                                )}
                            </div>

                            {/* Health Score */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Health Score</h3>
                                {diseasePredictions?.overallHealthScore ? (
                                    <div className="text-center">
                                        <div className="text-3xl font-extrabold text-indigo-400">{diseasePredictions.overallHealthScore}/100</div>
                                        <div className="w-full bg-white/10 h-1.5 rounded-full mt-2">
                                            <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${diseasePredictions.overallHealthScore}%` }}></div>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-500 italic">No assessment generated</p>
                                )}
                            </div>

                            {/* Risk Segment */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Risk Segment</h3>
                                {riskSegment ? (
                                    <div className="space-y-1 text-xs">
                                        <p className="capitalize font-bold text-amber-400">
                                            {(riskSegment.segment || riskSegment?.segment_details?.segment || 'low').replace('_', ' ')}
                                        </p>
                                        <p className="text-gray-400 text-[10px]">
                                            Expert monitoring: {expertCases.length > 0 ? `${expertCases[0].status} (${expertCases[0].escalation_level})` : 'Inactive'}
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-500 italic">Risk evaluation pending</p>
                                )}
                            </div>


                        </div>

                        {/* Alerts Notification Strip */}
                        {(() => {
                            const uniqueAlerts = [];
                            const seenMsgs = new Set();
                            for (const alert of userAlerts || []) {
                                if (alert && alert.message && !seenMsgs.has(alert.message)) {
                                    seenMsgs.add(alert.message);
                                    uniqueAlerts.push(alert);
                                }
                            }
                            if (uniqueAlerts.length === 0) return null;

                            return (
                                <div className="bg-red-500/10 border border-red-500/25 rounded-3xl p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider">Active Location Outbreak Warnings</h3>
                                        <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold">{uniqueAlerts.length} Warnings</span>
                                    </div>
                                    <div className="space-y-3">
                                        {uniqueAlerts.slice(0, 2).map((alert, idx) => (
                                            <div key={alert.id || idx} className="bg-[#191421] border border-red-500/20 p-4 rounded-2xl text-xs flex justify-between gap-4">
                                                <div>
                                                    <p className="font-semibold text-white">Disease Alert</p>
                                                    <p className="text-gray-300 mt-1 leading-relaxed">{alert.message}</p>
                                                </div>
                                                <div className="text-right text-[10px] text-gray-500 flex-shrink-0">
                                                    <p>{formatTimestamp(alert.created_at)}</p>
                                                    <p className="text-red-400/70 mt-1">{formatTimeAgo(alert.created_at)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Consulting Doctors Section & Request Link (Patient Only) */}
                        {user?.role === 'patient' && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Left Form Column */}
                                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 lg:col-span-1">
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Consult a Doctor</h3>
                                    <p className="text-xs text-gray-400 mb-4">Connect to a professional by typing their registered email address.</p>
                                    
                                    <form onSubmit={handleConnectDoctor} className="space-y-3">
                                        <input
                                            type="email"
                                            value={connectDoctorEmail}
                                            onChange={(e) => setConnectDoctorEmail(e.target.value)}
                                            placeholder="doctor@proxihealth.com"
                                            className="w-full bg-[#121724] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                            required
                                        />
                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="w-full bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600 text-white rounded-xl py-2 text-xs font-semibold shadow transition-all duration-200"
                                        >
                                            {isLoading ? 'Connecting...' : 'Establish Connection'}
                                        </button>
                                    </form>
                                </div>

                                {/* Right Consulting List Column */}
                                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 lg:col-span-2">
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Your Consulting Doctors</h3>
                                    {patientDoctors.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {patientDoctors.map((doc) => (
                                                <div key={doc.id} className="bg-[#121724] border border-white/5 rounded-2xl p-4 text-xs">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <h4 className="font-bold text-white text-sm">{doc.name}</h4>
                                                            <p className="text-[10px] text-indigo-400 font-semibold mt-0.5">{doc.specialty}</p>
                                                        </div>
                                                        <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-mono uppercase">{doc.consultationMode}</span>
                                                    </div>
                                                    <p className="text-gray-400 mt-2"><span className="font-medium text-gray-300">Clinic:</span> {doc.clinicName}</p>
                                                    <p className="text-gray-400"><span className="font-medium text-gray-300">Experience:</span> {doc.yearsOfExperience} years</p>
                                                    {doc.bio && <p className="text-[11px] text-gray-500 italic mt-2 border-t border-white/5 pt-2">"{doc.bio}"</p>}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 text-xs text-gray-500 italic">No assigned consulting doctors. Enter a doctor's email above to establish a link.</div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Telemetry charts & medication overview */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            
                            {/* Weekly Trends */}
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Weekly Health Telemetry</h3>
                                <div className="h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={generateWeeklyHealthData()}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" />
                                            <XAxis dataKey="day" stroke="#9ca3af" fontSize={11} />
                                            <YAxis stroke="#9ca3af" fontSize={11} />
                                            <Tooltip contentStyle={{ backgroundColor: '#131926', borderColor: '#ffffff1a', borderRadius: '12px', fontSize: '12px' }} />
                                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                                            <Line type="monotone" dataKey="steps" stroke="#6366f1" strokeWidth={2.5} name="Daily Steps" activeDot={{ r: 6 }} />
                                            <Line type="monotone" dataKey="heartRate" stroke="#ef4444" strokeWidth={2.5} name="Heart Rate (bpm)" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Prescriptions (Patient perspective) */}
                            {user?.role === 'patient' && (
                                <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Doctor Prescribed Medications</h3>
                                    {prescriptions.length > 0 ? (
                                        <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                                            {prescriptions.map((prescription) => (
                                                <div key={prescription.id} className="bg-[#121724] border border-white/5 p-4 rounded-2xl text-xs flex justify-between">
                                                    <div>
                                                        <h4 className="font-bold text-white text-sm">{prescription.medicine_name}</h4>
                                                        <p className="text-gray-400 mt-1"><span className="font-semibold text-gray-300">Dosage:</span> {prescription.dosage} | {prescription.frequency}</p>
                                                        {prescription.duration_days && <p className="text-gray-400"><span className="font-semibold text-gray-300">Duration:</span> {prescription.duration_days} days</p>}
                                                        {prescription.instructions && <p className="text-indigo-400/90 italic mt-1.5 font-medium">"{prescription.instructions}"</p>}
                                                    </div>
                                                    <div className="text-[10px] text-gray-500 font-mono text-right flex-shrink-0">
                                                        {formatTimestamp(prescription.created_at)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-10 text-xs text-gray-500 italic">No medication files shared in your catalog yet.</div>
                                    )}
                                </div>
                            )}

                        </div>

                    </div>
                )}

                {/* 2. DISEASE OUTBREAKS TAB */}
                {activeTab === 'outbreaks' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-extrabold text-white">Epidemiological Outbreaks (Kerala)</h2>
                                <p className="text-xs text-gray-400 mt-1">Live updates from state tracking feeds, media nodes, and surveillance channels.</p>
                            </div>
                            <button
                                onClick={fetchDiseaseOutbreaks}
                                className="bg-[#1b2234] hover:bg-white/5 border border-white/10 text-gray-300 rounded-xl px-4 py-2 text-xs font-semibold transition-all"
                            >
                                Refresh Feed
                            </button>
                        </div>

                        {diseaseOutbreaks.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {diseaseOutbreaks.map((outbreak, idx) => (
                                    <div key={outbreak.id || idx} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:border-indigo-500/30 transition-all duration-300">
                                        <div>
                                            <div className="flex justify-between items-start mb-3">
                                                <h3 className="font-bold text-white text-base">{outbreak.disease_name}</h3>
                                                <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                                                    outbreak.severity === 'high' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                                    outbreak.severity === 'medium' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                    'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                }`}>{outbreak.severity} severity</span>
                                            </div>
                                            <div className="space-y-1.5 text-xs text-gray-300">
                                                <p><span className="font-semibold text-gray-400">Location:</span> {outbreak.district}, {outbreak.location}</p>
                                                {outbreak.cases > 0 && <p><span className="font-semibold text-gray-400">Cases Recorded:</span> {outbreak.cases}</p>}
                                                <p><span className="font-semibold text-gray-400">Feed Source:</span> {outbreak.source}</p>
                                                {outbreak.news_title && (
                                                    <p className="text-gray-400 italic text-[11px] bg-black/20 p-2.5 rounded-xl border border-white/5 mt-3 leading-relaxed">
                                                        "{outbreak.news_title}"
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        {outbreak.precautions && outbreak.precautions.length > 0 && (
                                            <div className="mt-4 pt-3 border-t border-white/5">
                                                <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider mb-1.5">Actionable Precautions:</p>
                                                <ul className="text-xs text-gray-400 space-y-1">
                                                    {outbreak.precautions.map((prec, pIdx) => (
                                                        <li key={pIdx}>• {prec}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white/5 border border-white/10 rounded-3xl py-16 text-center text-xs text-gray-500 italic">No epidemiological records matching location scopes.</div>
                        )}
                    </div>
                )}

                {/* 3. HEALTH PREDICTIONS TAB */}
                {activeTab === 'predictions' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-extrabold text-white">AI-Powered Risk Assessment</h2>
                                <p className="text-xs text-gray-400 mt-1">Multi-factor projection analyzing steps, activity telemetry, and demographic parameters.</p>
                            </div>
                            <button
                                onClick={handleGeneratePredictions}
                                disabled={isLoading}
                                className="bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600 text-white rounded-xl px-4 py-2 text-xs font-semibold transition-all disabled:opacity-40"
                            >
                                {isLoading ? 'Recalculating...' : 'Refresh Predictions'}
                            </button>
                        </div>

                        {diseasePredictions ? (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                                {/* Left 2 columns: Predictions list */}
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                                        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Risk Projections Catalog</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {Object.entries(diseasePredictions.predictions || {}).map(([key, item]) => (
                                                <div key={key} className="bg-[#121724] border border-white/5 p-4 rounded-2xl text-xs space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <h4 className="font-bold text-white capitalize text-sm">{key.replace(/_/g, ' ')}</h4>
                                                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase ${
                                                            item.risk === 'high' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                                            item.risk === 'medium' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                            'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                        }`}>{item.risk}</span>
                                                    </div>
                                                    <div>
                                                        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                                            <span>Probability Confidence</span>
                                                            <span>{(item.probability * 100).toFixed(1)}%</span>
                                                        </div>
                                                        <div className="w-full bg-white/10 h-1.5 rounded-full">
                                                            <div className={`h-1.5 rounded-full ${
                                                                item.risk === 'high' ? 'bg-red-500' :
                                                                item.risk === 'medium' ? 'bg-amber-500' :
                                                                'bg-emerald-500'
                                                            }`} style={{ width: `${item.probability * 100}%` }}></div>
                                                        </div>
                                                    </div>
                                                    {item.factors && item.factors.length > 0 && (
                                                        <div className="pt-2 border-t border-white/5 mt-2">
                                                            <p className="text-[10px] text-gray-500 uppercase font-semibold">Contributing Vectors:</p>
                                                            <ul className="text-gray-400 text-[10px] space-y-0.5 mt-1">
                                                                {item.factors.map((f, fIdx) => (
                                                                    <li key={fIdx}>• {f.description}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* recommendations */}
                                    {diseasePredictions.recommendations && diseasePredictions.recommendations.length > 0 && (
                                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                                            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Precision Clinical Advice</h3>
                                            <div className="space-y-4">
                                                {diseasePredictions.recommendations.map((rec, rIdx) => (
                                                    <div key={rIdx} className="bg-indigo-500/5 border border-indigo-500/15 p-4 rounded-2xl text-xs">
                                                        <h4 className="font-bold text-indigo-300 text-sm">{rec.title}</h4>
                                                        <p className="text-gray-400 mt-1 leading-relaxed">{rec.description}</p>
                                                        <p className="text-[10px] text-emerald-400 font-semibold mt-2.5">Target Timeline: {rec.timeline}</p>
                                                        {rec.actions && rec.actions.length > 0 && (
                                                            <div className="mt-2 text-gray-300">
                                                                {rec.actions.map((act, aIdx) => (
                                                                    <p key={aIdx}>• {act}</p>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Right 1 column: 10 Year Future Risk */}
                                <div className="lg:col-span-1 space-y-6">
                                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                                        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">10-Year Risk Timeline</h3>
                                        {futureDiseaseRisk?.futurePredictions ? (
                                            <div className="space-y-4">
                                                <div className="bg-[#121724] border border-white/5 p-4 rounded-2xl text-center">
                                                    <p className="text-xs text-gray-400">Overall Health Horizon Score</p>
                                                    <div className="text-3xl font-black text-indigo-400 mt-1">{futureDiseaseRisk.overallHealthScore || 0}/100</div>
                                                </div>
                                                <div className="space-y-3">
                                                    {Object.values(futureDiseaseRisk.predictions || {}).map((item, idx) => (
                                                        <div key={idx} className="border-b border-white/5 pb-3 last:border-0 last:pb-0 text-xs">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="font-semibold text-white">{item.disease}</span>
                                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                                                    item.riskLevel === 'high' ? 'bg-red-500/10 text-red-400' :
                                                                    item.riskLevel === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                                                                    'bg-emerald-500/10 text-emerald-400'
                                                                }`}>{item.riskLevel}</span>
                                                            </div>
                                                            <p className="text-[10px] text-gray-500">Projected: {item.projectedIn} • Prob: {(item.probability * 100).toFixed(1)}%</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-500 italic">No future prognosis catalog generated.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white/5 border border-white/10 rounded-3xl py-16 text-center space-y-3">
                                <p className="text-sm font-semibold text-gray-400">
                                    {healthAssessmentStatus.connected
                                        ? 'No predictions generated yet'
                                        : 'Health Assessment not completed'}
                                </p>
                                <p className="text-xs text-gray-500 italic max-w-xs mx-auto">
                                    {healthAssessmentStatus.connected
                                        ? 'Click "Refresh Predictions" above to run an AI risk assessment on your health data.'
                                        : 'Complete the Health Assessment form from the overview actions or tab to enable AI-powered predictions.'}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* 4. DOCTOR CONSOLE TAB */}
                {activeTab === 'doctor' && user?.role === 'doctor' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                        {/* Left Column: Assigned Patients */}
                        <div className="lg:col-span-1 space-y-6">
                            
                            {/* Assign input */}
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Connect Patient UUID</h3>
                                <p className="text-xs text-gray-400 mb-4">Assign a patient to your directory by entering their UUID.</p>
                                
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={doctorPatientId}
                                        onChange={(e) => setDoctorPatientId(e.target.value)}
                                        placeholder="Paste patient UUID"
                                        className="w-full bg-[#121724] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
                                    />
                                    <button
                                        onClick={assignPatientToDoctor}
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2 text-xs font-semibold transition-all"
                                    >
                                        Add Patient
                                    </button>
                                </div>
                            </div>

                            {/* Patients List */}
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Your Patients Directory</h3>
                                {doctorPatients.length > 0 ? (
                                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                                        {doctorPatients.map((entry) => {
                                            const isSelected = selectedPatient?.patient?.id === entry.patient?.id;
                                            return (
                                                <button
                                                    key={entry.patient?.id}
                                                    onClick={() => setSelectedPatient(entry)}
                                                    className={`w-full text-left p-3.5 rounded-xl border text-xs transition-all ${
                                                        isSelected
                                                            ? 'bg-indigo-500/10 border-indigo-500/40 text-white shadow-lg'
                                                            : 'bg-[#121724] border-white/5 hover:border-white/15 text-gray-300'
                                                    }`}
                                                >
                                                    <h4 className="font-bold">{entry.patient?.name}</h4>
                                                    <p className="text-gray-400 text-[10px] mt-0.5 truncate">{entry.patient?.email}</p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-500 italic">No connected patient accounts found.</p>
                                )}
                            </div>

                        </div>

                        {/* Right Patient Folder Column */}
                        <div className="lg:col-span-2">
                            {selectedPatient ? (
                                <div className="space-y-6">
                                    {/* Patient Demographics */}
                                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="text-lg font-bold text-white">{selectedPatient.patient.name}</h3>
                                                <p className="text-[10px] text-gray-400 font-mono mt-0.5">UUID: {selectedPatient.patient.id}</p>
                                            </div>
                                            <button
                                                onClick={() => setSelectedPatient(null)}
                                                className="bg-white/5 border border-white/10 text-gray-400 hover:text-white px-2.5 py-1 rounded-lg text-[10px] font-semibold"
                                            >
                                                Close Folder
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mt-4 pt-4 border-t border-white/5">
                                            <div>
                                                <span className="text-gray-500 block">Age / Gender</span>
                                                <span className="font-semibold text-white capitalize">{selectedPatient.patient.age || 'N/A'} yrs / {selectedPatient.patient.gender || 'N/A'}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500 block">Weight / Height</span>
                                                <span className="font-semibold text-white">{selectedPatient.patient.weight ? `${selectedPatient.patient.weight} kg` : 'N/A'} / {selectedPatient.patient.height ? `${selectedPatient.patient.height} cm` : 'N/A'}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500 block">Smoking Habits</span>
                                                <span className="font-semibold text-white capitalize">{selectedPatient.patient.smoker || 'No'}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500 block">Alcohol habits</span>
                                                <span className="font-semibold text-white capitalize">{selectedPatient.patient.alcohol_consumption || 'None'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Telemetry data & predictions */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Telemetry */}
                                        {/* Telemetry / Health Assessment Data */}
                                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                                            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Health Assessment Data</h4>
                                            {selectedPatient.healthData ? (
                                                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 text-xs text-gray-300">
                                                    <div className="bg-[#121724] border border-white/5 p-4 rounded-xl space-y-3">
                                                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] border-b border-white/5 pb-3">
                                                            <p><span className="font-semibold text-gray-500">Daily Steps:</span> <span className="text-indigo-400 font-medium">{selectedPatient.healthData.daily_steps || 0}</span></p>
                                                            <p><span className="font-semibold text-gray-500">Heart Rate:</span> <span className="text-indigo-400 font-medium">{selectedPatient.healthData.resting_heart_rate || 72} bpm</span></p>
                                                            <p><span className="font-semibold text-gray-500">Sleep Hours:</span> <span className="text-indigo-400 font-medium">{selectedPatient.healthData.sleep_hours || 7} hrs</span></p>
                                                            <p><span className="font-semibold text-gray-500">Deep Sleep:</span> <span className="text-indigo-400 font-medium">{selectedPatient.healthData.deep_sleep_hours || 1.5} hrs</span></p>
                                                            <p><span className="font-semibold text-gray-500">Blood Oxygen:</span> <span className="text-indigo-400 font-medium">{selectedPatient.healthData.blood_oxygen_level || 98}%</span></p>
                                                            <p><span className="font-semibold text-gray-500">Activity Level:</span> <span className="text-indigo-400 font-medium capitalize">{(selectedPatient.healthData.physical_activity_level || 'lightly_active').replace('_', ' ')}</span></p>
                                                            <p><span className="font-semibold text-gray-500">Stress Level:</span> <span className="text-indigo-400 font-medium capitalize">{selectedPatient.healthData.stress_level || 'medium'}</span></p>
                                                            <p><span className="font-semibold text-gray-500">Diet Quality:</span> <span className="text-indigo-400 font-medium capitalize">{selectedPatient.healthData.diet_quality || 'fair'}</span></p>
                                                            <p><span className="font-semibold text-gray-500">Water Intake:</span> <span className="text-indigo-400 font-medium">{selectedPatient.healthData.water_intake_liters || 2} L</span></p>
                                                            <p><span className="font-semibold text-gray-500">Last Checkup:</span> <span className="text-indigo-400 font-medium">{selectedPatient.healthData.last_checkup_months || 12} mos ago</span></p>
                                                        </div>
                                                        {selectedPatient.healthData.chronic_conditions && selectedPatient.healthData.chronic_conditions.length > 0 && (
                                                            <div className="text-[11px] pb-1">
                                                                <span className="font-semibold text-gray-500">Chronic Conditions:</span>
                                                                <p className="text-indigo-300 mt-0.5">{selectedPatient.healthData.chronic_conditions.join(', ')}</p>
                                                            </div>
                                                        )}
                                                        {selectedPatient.healthData.family_history && selectedPatient.healthData.family_history.length > 0 && (
                                                            <div className="text-[11px] pb-1">
                                                                <span className="font-semibold text-gray-500">Family History:</span>
                                                                <p className="text-indigo-300 mt-0.5">{selectedPatient.healthData.family_history.join(', ')}</p>
                                                            </div>
                                                        )}
                                                        {selectedPatient.healthData.current_symptoms && selectedPatient.healthData.current_symptoms.length > 0 && (
                                                            <div className="text-[11px] pb-1">
                                                                <span className="font-semibold text-gray-500">Current Symptoms:</span>
                                                                <p className="text-amber-400 mt-0.5">{selectedPatient.healthData.current_symptoms.join(', ')}</p>
                                                            </div>
                                                        )}
                                                        <p className="text-[10px] text-gray-500 pt-2 border-t border-white/5">Submitted: {formatTimestamp(selectedPatient.healthData.updated_at)}</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-gray-500 italic">No health assessment data submitted by patient.</p>
                                            )}
                                        </div>

                                        {/* Future Prognosis */}
                                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                                            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">10-Year Risk Matrix</h4>
                                            {selectedPatient.futureRisk?.predictions && selectedPatient.futureRisk.predictions.length > 0 ? (
                                                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                                    {selectedPatient.futureRisk.predictions.map((p, idx) => (
                                                        <div key={idx} className="border-b border-white/5 pb-2.5 last:border-0 last:pb-0 text-xs">
                                                            <div className="flex justify-between items-center">
                                                                <span className="font-semibold text-white">{p.disease}</span>
                                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                                                    p.riskLevel === 'high' ? 'bg-red-500/10 text-red-400' :
                                                                    p.riskLevel === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                                                                    'bg-emerald-500/10 text-emerald-400'
                                                                }`}>{p.riskLevel}</span>
                                                            </div>
                                                            <p className="text-[10px] text-gray-500 mt-0.5">Prob: {(p.probability * 100).toFixed(1)}%</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-gray-500 italic">Prognosis metrics pending sync events.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Issue Prescription Section */}
                                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                                        <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Medical Prescriptions</h4>
                                        
                                        {/* Existing Prescriptions List */}
                                        {selectedPatient.prescriptions && selectedPatient.prescriptions.length > 0 && (
                                            <div className="space-y-2.5 mb-6 max-h-48 overflow-y-auto pr-1">
                                                {selectedPatient.prescriptions.map((prescription) => (
                                                    <div key={prescription.id} className="bg-[#121724] border border-white/5 p-3 rounded-xl text-xs">
                                                        <div className="flex justify-between font-bold text-white">
                                                            <span>{prescription.medicine_name}</span>
                                                            <span className="text-[10px] font-normal text-gray-500">{formatTimestamp(prescription.created_at)}</span>
                                                        </div>
                                                        <p className="text-gray-400 mt-1">{prescription.dosage} {prescription.frequency ? `• ${prescription.frequency}` : ''}</p>
                                                        {prescription.instructions && <p className="text-indigo-400 italic mt-1">"{prescription.instructions}"</p>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Prescription Form */}
                                        <form onSubmit={handleAddPrescription} className="border-t border-white/5 pt-4 space-y-3">
                                            <h5 className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">Issue New Medication</h5>
                                            <div className="grid grid-cols-2 gap-3">
                                                <input
                                                    type="text"
                                                    placeholder="Medicine Name (e.g. Paracetamol)"
                                                    value={newPrescription.medicineName}
                                                    onChange={(e) => setNewPrescription({...newPrescription, medicineName: e.target.value})}
                                                    className="bg-[#121724] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                                    required
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Dosage (e.g. 500mg)"
                                                    value={newPrescription.dosage}
                                                    onChange={(e) => setNewPrescription({...newPrescription, dosage: e.target.value})}
                                                    className="bg-[#121724] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <input
                                                    type="text"
                                                    placeholder="Frequency (e.g. Twice Daily)"
                                                    value={newPrescription.frequency}
                                                    onChange={(e) => setNewPrescription({...newPrescription, frequency: e.target.value})}
                                                    className="bg-[#121724] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                                />
                                                <input
                                                    type="number"
                                                    placeholder="Duration (Days)"
                                                    value={newPrescription.durationDays}
                                                    onChange={(e) => setNewPrescription({...newPrescription, durationDays: e.target.value})}
                                                    className="bg-[#121724] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                                    min="1"
                                                />
                                            </div>
                                            <textarea
                                                placeholder="Instructions (e.g. Take after meals, dissolve in water)"
                                                value={newPrescription.instructions}
                                                onChange={(e) => setNewPrescription({...newPrescription, instructions: e.target.value})}
                                                className="w-full bg-[#121724] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                                rows="2"
                                            />
                                            <button
                                                type="submit"
                                                className="w-full bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600 text-white rounded-xl py-2 text-xs font-semibold transition-all shadow"
                                            >
                                                Prescribe Medication
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white/5 border border-white/10 rounded-3xl py-24 text-center border-dashed flex flex-col items-center justify-center">
                                    <svg className="h-12 w-12 text-indigo-500/30 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <h4 className="text-xs font-bold text-gray-400">Select a Patient</h4>
                                    <p className="text-[11px] text-gray-500 max-w-xs mt-1">Select a patient entry from your directory folder on the left to consult telemetry and authorize prescriptions.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 5. PROFILE TAB */}
                {activeTab === 'profile' && (
                    <div className="space-y-6">
                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                            <h2 className="text-xl font-extrabold text-white mb-6">Profile Settings</h2>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                                <div className="space-y-1">
                                    <span className="text-gray-500 block">Name</span>
                                    <p className="font-semibold text-white text-sm">{user?.name}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-gray-500 block">Email Address</span>
                                    <p className="font-semibold text-white text-sm">{user?.email}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-gray-500 block">User Account Role</span>
                                    <p className="font-semibold text-indigo-400 capitalize text-sm">{user?.role}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-gray-500 block">User ID (System UUID)</span>
                                    <p className="font-mono text-[11px] text-gray-400 flex items-center space-x-1.5">
                                        <span>{user?.id}</span>
                                        <button 
                                            onClick={() => handleCopyUUID(user?.id)}
                                            className="hover:text-white transition-colors"
                                            title="Copy ID"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                            </svg>
                                        </button>
                                    </p>
                                </div>
                                
                                {user?.role === 'patient' && (
                                    <>
                                        <div className="space-y-1">
                                            <span className="text-gray-500 block">Age</span>
                                            <p className="font-semibold text-white text-sm">{user?.age || 'N/A'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-gray-500 block">Gender</span>
                                            <p className="font-semibold text-white text-sm capitalize">{user?.gender || 'N/A'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-gray-500 block">Weight</span>
                                            <p className="font-semibold text-white text-sm">{user?.weight ? `${user.weight} kg` : 'N/A'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-gray-500 block">Height</span>
                                            <p className="font-semibold text-white text-sm">{user?.height ? `${user.height} cm` : 'N/A'}</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 6. HEALTH ASSESSMENT TAB */}
                {activeTab === 'assessment' && user?.role === 'patient' && (
                    <div className="space-y-6">
                        <HealthQuestionnaire onSaveSuccess={async () => {
                            await fetchDiseasePredictions();
                            await fetchFutureDiseaseRisk();
                            await fetchRiskSegmentation();
                            await checkHealthAssessmentStatus();
                        }} />
                    </div>
                )}

            </main>
        </div>
    );
};

export default Dashboard;