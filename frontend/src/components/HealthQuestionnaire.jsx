import React, { useState, useEffect } from 'react';
import { saveHealthData, fetchHealthData } from '../api';

export default function HealthQuestionnaire({ onSaveSuccess }) {
  const [form, setForm] = useState({
    dailySteps: '',
    restingHeartRate: '',
    sleepHours: '',
    deepSleepHours: '',
    stressLevel: 'medium',
    physicalActivityLevel: 'lightly_active',
    weeklyExerciseHours: '',
    chronicConditions: '',
    familyHistory: '',
    currentSymptoms: '',
    dietQuality: 'fair',
    waterIntakeLiters: '',
    bloodOxygenLevel: '',
    lastCheckupMonths: '',
    onMedication: false,
    medicationDetails: '',
    snoring: false,
    wakeupsPerNight: '',
    mood: 'neutral'
  });
  const [status, setStatus] = useState({ message: '', type: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await fetchHealthData();
        if (data) {
          setForm({
            dailySteps: data.daily_steps ?? '',
            restingHeartRate: data.resting_heart_rate ?? '',
            sleepHours: data.sleep_hours ?? '',
            deepSleepHours: data.deep_sleep_hours ?? '',
            stressLevel: data.stress_level ?? 'medium',
            physicalActivityLevel: data.physical_activity_level ?? 'lightly_active',
            weeklyExerciseHours: data.weekly_exercise_hours ?? '',
            chronicConditions: Array.isArray(data.chronic_conditions) ? data.chronic_conditions.join(', ') : '',
            familyHistory: Array.isArray(data.family_history) ? data.family_history.join(', ') : '',
            currentSymptoms: Array.isArray(data.current_symptoms) ? data.current_symptoms.join(', ') : '',
            dietQuality: data.diet_quality ?? 'fair',
            waterIntakeLiters: data.water_intake_liters ?? '',
            bloodOxygenLevel: data.blood_oxygen_level ?? '',
            lastCheckupMonths: data.last_checkup_months ?? '',
            onMedication: data.on_medication ?? false,
            medicationDetails: data.medication_details ?? '',
            snoring: data.snoring ?? false,
            wakeupsPerNight: data.wakeups_per_night ?? '',
            mood: data.mood ?? 'neutral'
          });
        }
      } catch (err) {
        console.error('Failed to load health data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ message: 'Saving telemetry data...', type: 'info' });
    try {
      const payload = {
        ...form,
        chronicConditions: form.chronicConditions
          ? form.chronicConditions.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        familyHistory: form.familyHistory
          ? form.familyHistory.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        currentSymptoms: form.currentSymptoms
          ? form.currentSymptoms.split(',').map((s) => s.trim()).filter(Boolean)
          : []
      };
      await saveHealthData(payload);
      setStatus({ message: 'Health assessment saved successfully!', type: 'success' });
      if (onSaveSuccess) {
        onSaveSuccess();
      }
    } catch (err) {
      setStatus({ message: err.message || 'Save failed', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 bg-[#111625]/50 border border-white/5 rounded-3xl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-xs text-gray-400">Loading your health data...</p>
        </div>
      </div>
    );
  }

  const inputClass = "w-full bg-[#1b2234] border border-white/10 focus:border-indigo-500 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all";
  const labelClass = "block text-xs font-semibold text-gray-400 mb-1.5";
  const cardClass = "bg-[#161c2a] border border-white/5 rounded-2xl p-6 space-y-4";
  const sectionTitleClass = "text-sm font-bold text-indigo-400 border-b border-white/5 pb-2 mb-4 tracking-wide uppercase";

  return (
    <div className="bg-[#111625]/90 backdrop-blur-md border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-extrabold text-white tracking-tight">Health Assessment Form</h2>
        <p className="text-xs text-gray-400 mt-1">Provide your lifestyle metrics and medical history to update disease prediction models.</p>
      </div>

      {status.message && (
        <div className={`mb-6 p-4 rounded-xl text-xs font-semibold border ${
          status.type === 'error' ? 'bg-red-500/10 border-red-500/25 text-red-400' : 
          status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 
          'bg-indigo-500/10 border-indigo-500/25 text-indigo-400'
        }`}>
          {status.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card 1: Vital Metrics */}
          <div className={cardClass}>
            <h3 className={sectionTitleClass}>Daily Vital Telemetry</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Daily Steps</label>
                <input
                  type="number"
                  name="dailySteps"
                  placeholder="e.g. 10000"
                  value={form.dailySteps}
                  onChange={handleChange}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Resting Heart Rate (BPM)</label>
                <input
                  type="number"
                  name="restingHeartRate"
                  placeholder="e.g. 65"
                  value={form.restingHeartRate}
                  onChange={handleChange}
                  required
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Blood Oxygen Level (%)</label>
                <input
                  type="number"
                  step="0.1"
                  name="bloodOxygenLevel"
                  placeholder="e.g. 98.5"
                  value={form.bloodOxygenLevel}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Sleep & Restoration */}
          <div className={cardClass}>
            <h3 className={sectionTitleClass}>Sleep & Restoration</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Total Sleep (Hours)</label>
                <input
                  type="number"
                  step="0.1"
                  name="sleepHours"
                  placeholder="e.g. 7.5"
                  value={form.sleepHours}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Deep Sleep (Hours)</label>
                <input
                  type="number"
                  step="0.1"
                  name="deepSleepHours"
                  placeholder="e.g. 1.8"
                  value={form.deepSleepHours}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Wakeups per Night</label>
                <input
                  type="number"
                  name="wakeupsPerNight"
                  placeholder="e.g. 1"
                  value={form.wakeupsPerNight}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col justify-end pb-3">
                <label className="flex items-center space-x-3 text-xs text-gray-300 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    name="snoring"
                    checked={form.snoring}
                    onChange={handleChange}
                    className="h-4.5 w-4.5 rounded border-white/10 bg-[#1b2234] text-indigo-600 focus:ring-indigo-500/20"
                  />
                  <span>Frequent Snoring</span>
                </label>
              </div>
            </div>
          </div>

          {/* Card 3: Lifestyle & Diet */}
          <div className={cardClass}>
            <h3 className={sectionTitleClass}>Lifestyle & Habits</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Physical Activity Level</label>
                <select
                  name="physicalActivityLevel"
                  value={form.physicalActivityLevel}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="sedentary">Sedentary</option>
                  <option value="lightly_active">Lightly Active</option>
                  <option value="active">Active</option>
                  <option value="very_active">Very Active</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Weekly Exercise (Hours)</label>
                <input
                  type="number"
                  step="0.1"
                  name="weeklyExerciseHours"
                  placeholder="e.g. 3.5"
                  value={form.weeklyExerciseHours}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Stress Level</label>
                <select
                  name="stressLevel"
                  value={form.stressLevel}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="low">Low Stress</option>
                  <option value="medium">Medium Stress</option>
                  <option value="high">High Stress</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Daily Water Intake (Liters)</label>
                <input
                  type="number"
                  step="0.1"
                  name="waterIntakeLiters"
                  placeholder="e.g. 2.5"
                  value={form.waterIntakeLiters}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Diet Quality</label>
                <select
                  name="dietQuality"
                  value={form.dietQuality}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="poor">Poor</option>
                  <option value="fair">Fair</option>
                  <option value="good">Good</option>
                  <option value="excellent">Excellent</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Current Mood</label>
                <select
                  name="mood"
                  value={form.mood}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="sad">Sad / Low</option>
                  <option value="stressed">Stressed / Anxious</option>
                  <option value="neutral">Neutral</option>
                  <option value="happy">Happy / Good</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card 4: Clinical History */}
          <div className={cardClass}>
            <h3 className={sectionTitleClass}>Clinical History</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Months Since Last Check-up</label>
                  <input
                    type="number"
                    name="lastCheckupMonths"
                    placeholder="e.g. 6"
                    value={form.lastCheckupMonths}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col justify-end pb-3">
                  <label className="flex items-center space-x-3 text-xs text-gray-300 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      name="onMedication"
                      checked={form.onMedication}
                      onChange={handleChange}
                      className="h-4.5 w-4.5 rounded border-white/10 bg-[#1b2234] text-indigo-600 focus:ring-indigo-500/20"
                    />
                    <span>Currently On Medication</span>
                  </label>
                </div>
              </div>

              {form.onMedication && (
                <div>
                  <label className={labelClass}>Medication Details</label>
                  <textarea
                    name="medicationDetails"
                    placeholder="List drug names and dosages..."
                    value={form.medicationDetails}
                    onChange={handleChange}
                    rows="2"
                    className={`${inputClass} resize-none`}
                  />
                </div>
              )}

              <div>
                <label className={labelClass}>Chronic Conditions (comma separated)</label>
                <input
                  type="text"
                  name="chronicConditions"
                  placeholder="e.g. diabetes, asthma, none"
                  value={form.chronicConditions}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Family Medical History (comma separated)</label>
                <input
                  type="text"
                  name="familyHistory"
                  placeholder="e.g. hypertension, heart disease"
                  value={form.familyHistory}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Current Symptoms (comma separated)</label>
                <input
                  type="text"
                  name="currentSymptoms"
                  placeholder="e.g. fatigue, cough, headache"
                  value={form.currentSymptoms}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            className="bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600 text-white font-bold py-3.5 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all text-xs"
          >
            Save Health Assessment
          </button>
        </div>
      </form>
    </div>
  );
}
