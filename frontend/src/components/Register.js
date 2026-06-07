import React, { useState } from 'react';

const Register = ({ onRegister, onSwitchToLogin }) => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        name: '',
        role: 'patient',
        doctorCode: '',
        specialty: '',
        licenseNumber: '',
        clinicName: '',
        consultationMode: 'hybrid',
        bio: '',
        yearsOfExperience: '',
        age: '',
        gender: '',
        weight: '',
        height: '',
        smoker: 'No',
        alcoholConsumption: 'None'
    });
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        // Email validation
        if (!formData.email) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Email is invalid';
        }

        // Password validation
        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters';
        } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
            newErrors.password = 'Password must contain at least one uppercase, lowercase and number';
        }

        // Confirm password validation
        if (!formData.confirmPassword) {
            newErrors.confirmPassword = 'Confirm your password';
        } else if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        // Name validation
        if (!formData.name.trim()) {
            newErrors.name = 'Name is required';
        }

        if (formData.role === 'doctor') {
            if (!formData.specialty.trim()) {
                newErrors.specialty = 'Specialty is required';
            }
            if (!formData.licenseNumber.trim()) {
                newErrors.licenseNumber = 'License number is required';
            }
            if (!formData.clinicName.trim()) {
                newErrors.clinicName = 'Clinic/hospital name is required';
            }
        }

        // Age validation
        if (formData.age && (isNaN(formData.age) || formData.age < 1 || formData.age > 120)) {
            newErrors.age = 'Invalid age';
        }

        // Weight validation
        if (formData.weight && (isNaN(formData.weight) || formData.weight < 20 || formData.weight > 300)) {
            newErrors.weight = 'Invalid weight (20-300 kg)';
        }

        // Height validation
        if (formData.height && (isNaN(formData.height) || formData.height < 100 || formData.height > 250)) {
            newErrors.height = 'Invalid height (100-250 cm)';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) return;

        setIsLoading(true);
        try {
            const registrationData = {
                email: formData.email,
                password: formData.password,
                name: formData.name,
                role: formData.role,
                doctorCode: formData.doctorCode,
                specialty: formData.specialty,
                licenseNumber: formData.licenseNumber,
                clinicName: formData.clinicName,
                consultationMode: formData.consultationMode,
                bio: formData.bio,
                yearsOfExperience: formData.yearsOfExperience,
                age: formData.age ? parseInt(formData.age) : null,
                gender: formData.gender || null,
                weight: formData.weight ? parseFloat(formData.weight) : null,
                height: formData.height ? parseFloat(formData.height) : null,
                smoker: formData.role === 'patient' ? formData.smoker : null,
                alcoholConsumption: formData.role === 'patient' ? formData.alcoholConsumption : null
            };
            
            await onRegister(registrationData);
        } catch (error) {
            setErrors({ general: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0B0F19] relative overflow-hidden font-sans py-12">
            {/* Glowing background blobs */}
            <div className="absolute top-[-25%] right-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-600/10 blur-[130px] pointer-events-none animate-pulse duration-[7000ms]"></div>
            <div className="absolute bottom-[-25%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/15 blur-[130px] pointer-events-none animate-pulse duration-[9000ms]"></div>

            <div className="max-w-xl w-full mx-4 z-10">
                {/* Brand / Logo */}
                <div className="flex flex-col items-center mb-6">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.3)] transition-transform duration-300 hover:scale-105">
                        <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                    </div>
                    <h2 className="mt-4 text-2xl font-extrabold text-white tracking-tight">
                        Create your account
                    </h2>
                    <p className="mt-1 text-xs text-gray-400">
                        Join ProxiHealth to monitor and sync clinical data
                    </p>
                </div>

                {/* Main Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
                    <form className="space-y-4" onSubmit={handleSubmit}>
                        
                        {/* Split Name and Role */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                                    Full Name *
                                </label>
                                <input
                                    id="name"
                                    name="name"
                                    type="text"
                                    required
                                    className={`appearance-none block w-full px-3 py-2 bg-white/5 border ${
                                        errors.name ? 'border-red-500/50' : 'border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                                    } rounded-xl text-white placeholder-gray-500 focus:outline-none sm:text-sm transition-all duration-200`}
                                    placeholder="Jane Doe"
                                    value={formData.name}
                                    onChange={handleChange}
                                />
                                {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
                            </div>

                            <div>
                                <label htmlFor="role" className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                                    Account Type *
                                </label>
                                <select
                                    id="role"
                                    name="role"
                                    className="block w-full px-3 py-2 bg-[#171b26] border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm transition-all duration-200"
                                    value={formData.role}
                                    onChange={handleChange}
                                >
                                    <option value="patient">Patient (User)</option>
                                    <option value="doctor">Medical Doctor</option>
                                </select>
                            </div>
                        </div>

                        {/* Conditional Doctor Form */}
                        {formData.role === 'doctor' && (
                            <div className="space-y-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 transition-all duration-300">
                                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Professional Credentials</p>
                                
                                <div>
                                    <label htmlFor="specialty" className="block text-[11px] font-semibold text-gray-300 mb-1">
                                        Specialty *
                                    </label>
                                    <input
                                        id="specialty"
                                        name="specialty"
                                        type="text"
                                        className={`appearance-none block w-full px-3 py-2 bg-white/5 border ${
                                            errors.specialty ? 'border-red-500/50' : 'border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                                        } rounded-xl text-white placeholder-gray-500 focus:outline-none sm:text-xs transition-all duration-200`}
                                        placeholder="Cardiology, General Practice, etc."
                                        value={formData.specialty}
                                        onChange={handleChange}
                                    />
                                    {errors.specialty && <p className="mt-1 text-xs text-red-400">{errors.specialty}</p>}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="licenseNumber" className="block text-[11px] font-semibold text-gray-300 mb-1">
                                            License Number *
                                        </label>
                                        <input
                                            id="licenseNumber"
                                            name="licenseNumber"
                                            type="text"
                                            className={`appearance-none block w-full px-3 py-2 bg-white/5 border ${
                                                errors.licenseNumber ? 'border-red-500/50' : 'border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                                            } rounded-xl text-white placeholder-gray-500 focus:outline-none sm:text-xs transition-all duration-200`}
                                            placeholder="REG-12345"
                                            value={formData.licenseNumber}
                                            onChange={handleChange}
                                        />
                                        {errors.licenseNumber && <p className="mt-1 text-xs text-red-400">{errors.licenseNumber}</p>}
                                    </div>

                                    <div>
                                        <label htmlFor="clinicName" className="block text-[11px] font-semibold text-gray-300 mb-1">
                                            Clinic / Hospital *
                                        </label>
                                        <input
                                            id="clinicName"
                                            name="clinicName"
                                            type="text"
                                            className={`appearance-none block w-full px-3 py-2 bg-white/5 border ${
                                                errors.clinicName ? 'border-red-500/50' : 'border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                                            } rounded-xl text-white placeholder-gray-500 focus:outline-none sm:text-xs transition-all duration-200`}
                                            placeholder="City General Hospital"
                                            value={formData.clinicName}
                                            onChange={handleChange}
                                        />
                                        {errors.clinicName && <p className="mt-1 text-xs text-red-400">{errors.clinicName}</p>}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="consultationMode" className="block text-[11px] font-semibold text-gray-300 mb-1">
                                            Consultation Mode
                                        </label>
                                        <select
                                            id="consultationMode"
                                            name="consultationMode"
                                            className="block w-full px-3 py-2 bg-[#171b26] border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 sm:text-xs"
                                            value={formData.consultationMode}
                                            onChange={handleChange}
                                        >
                                            <option value="hybrid">Hybrid (Online & Onsite)</option>
                                            <option value="online">Online Only</option>
                                            <option value="onsite">On-site Only</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label htmlFor="yearsOfExperience" className="block text-[11px] font-semibold text-gray-300 mb-1">
                                            Years of Experience
                                        </label>
                                        <input
                                            id="yearsOfExperience"
                                            name="yearsOfExperience"
                                            type="number"
                                            min="0"
                                            className="appearance-none block w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 sm:text-xs"
                                            placeholder="e.g. 8"
                                            value={formData.yearsOfExperience}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="doctorCode" className="block text-[11px] font-semibold text-gray-300 mb-1">
                                        Doctor Passcode (Registration Code)
                                    </label>
                                    <input
                                        id="doctorCode"
                                        name="doctorCode"
                                        type="password"
                                        className="appearance-none block w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 sm:text-xs"
                                        placeholder="Secret validation code"
                                        value={formData.doctorCode}
                                        onChange={handleChange}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="bio" className="block text-[11px] font-semibold text-gray-300 mb-1">
                                        Bio
                                    </label>
                                    <textarea
                                        id="bio"
                                        name="bio"
                                        rows="2"
                                        className="appearance-none block w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 sm:text-xs"
                                        placeholder="Brief professional summary..."
                                        value={formData.bio}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Email Input */}
                        <div>
                            <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                                Email Address *
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className={`appearance-none block w-full px-3 py-2 bg-white/5 border ${
                                    errors.email ? 'border-red-500/50' : 'border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                                } rounded-xl text-white placeholder-gray-500 focus:outline-none sm:text-sm transition-all duration-200`}
                                placeholder="name@domain.com"
                                value={formData.email}
                                onChange={handleChange}
                            />
                            {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email}</p>}
                        </div>

                        {/* Passwords Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                                    Password *
                                </label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="new-password"
                                    required
                                    className={`appearance-none block w-full px-3 py-2 bg-white/5 border ${
                                        errors.password ? 'border-red-500/50' : 'border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                                    } rounded-xl text-white placeholder-gray-500 focus:outline-none sm:text-sm transition-all duration-200`}
                                    placeholder="Min 8 chars"
                                    value={formData.password}
                                    onChange={handleChange}
                                />
                                {errors.password && <p className="mt-1 text-[10px] text-red-400 leading-normal">{errors.password}</p>}
                            </div>

                            <div>
                                <label htmlFor="confirmPassword" className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                                    Confirm *
                                </label>
                                <input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    autoComplete="new-password"
                                    required
                                    className={`appearance-none block w-full px-3 py-2 bg-white/5 border ${
                                        errors.confirmPassword ? 'border-red-500/50' : 'border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                                    } rounded-xl text-white placeholder-gray-500 focus:outline-none sm:text-sm transition-all duration-200`}
                                    placeholder="Re-type password"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                />
                                {errors.confirmPassword && <p className="mt-1 text-xs text-red-400">{errors.confirmPassword}</p>}
                            </div>
                        </div>

                        {/* Patient Telemetry Metadata */}
                        {formData.role === 'patient' && (
                            <div className="space-y-4 rounded-2xl border border-white/5 bg-white/5 p-4">
                                <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Health Telemetry Specs</p>
                                
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label htmlFor="age" className="block text-[10px] font-semibold text-gray-300 mb-1">Age</label>
                                        <input
                                            id="age"
                                            name="age"
                                            type="number"
                                            min="1"
                                            max="120"
                                            className="appearance-none block w-full px-2.5 py-1.5 bg-[#171b26] border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"
                                            placeholder="Yrs"
                                            value={formData.age}
                                            onChange={handleChange}
                                        />
                                        {errors.age && <p className="mt-0.5 text-[10px] text-red-400">{errors.age}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="gender" className="block text-[10px] font-semibold text-gray-300 mb-1">Gender</label>
                                        <select
                                            id="gender"
                                            name="gender"
                                            className="block w-full px-2 py-1.5 bg-[#171b26] border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"
                                            value={formData.gender}
                                            onChange={handleChange}
                                        >
                                            <option value="">Select</option>
                                            <option value="male">Male</option>
                                            <option value="female">Female</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="weight" className="block text-[10px] font-semibold text-gray-300 mb-1">Weight</label>
                                        <input
                                            id="weight"
                                            name="weight"
                                            type="number"
                                            step="0.1"
                                            className="appearance-none block w-full px-2.5 py-1.5 bg-[#171b26] border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"
                                            placeholder="kg"
                                            value={formData.weight}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label htmlFor="height" className="block text-[10px] font-semibold text-gray-300 mb-1">Height</label>
                                        <input
                                            id="height"
                                            name="height"
                                            type="number"
                                            step="0.1"
                                            className="appearance-none block w-full px-2.5 py-1.5 bg-[#171b26] border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"
                                            placeholder="cm"
                                            value={formData.height}
                                            onChange={handleChange}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="smoker" className="block text-[10px] font-semibold text-gray-300 mb-1">Smoker?</label>
                                        <select
                                            id="smoker"
                                            name="smoker"
                                            className="block w-full px-2 py-1.5 bg-[#171b26] border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"
                                            value={formData.smoker}
                                            onChange={handleChange}
                                        >
                                            <option value="No">No</option>
                                            <option value="Yes">Yes</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="alcoholConsumption" className="block text-[10px] font-semibold text-gray-300 mb-1">Alcohol?</label>
                                        <select
                                            id="alcoholConsumption"
                                            name="alcoholConsumption"
                                            className="block w-full px-2 py-1.5 bg-[#171b26] border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"
                                            value={formData.alcoholConsumption}
                                            onChange={handleChange}
                                        >
                                            <option value="None">None</option>
                                            <option value="Moderate">Moderate</option>
                                            <option value="Heavy">Heavy</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {errors.general && (
                            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400 flex items-center space-x-2">
                                <svg className="h-4 w-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                                <span>{errors.general}</span>
                            </div>
                        )}

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
                            >
                                {isLoading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Creating Account...
                                    </>
                                ) : (
                                    <>
                                        Create Account
                                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="text-center pt-2">
                            <button
                                type="button"
                                onClick={onSwitchToLogin}
                                className="text-gray-400 hover:text-emerald-400 text-xs font-semibold transition-colors duration-200"
                            >
                                Already have an account? Sign in
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Register;