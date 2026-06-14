import { API_BASE_URL } from './config';

/**
 * Save health data to the backend.
 * @param {Object} data - The health data payload.
 * @returns {Promise<Object>} The response JSON from the server.
 * @throws Will throw an error if the request fails.
 */
export async function saveHealthData(data) {
  const response = await fetch(`${API_BASE_URL}/health-data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    let errorMessage = 'Failed to save health data';
    try {
      const err = await response.json();
      errorMessage = err.error || errorMessage;
    } catch (jsonError) {
      const textError = await response.text().catch(() => '');
      errorMessage = textError || `Server error (status ${response.status})`;
    }
    throw new Error(errorMessage);
  }

  return await response.json();
}

/**
 * Fetch health data from the backend.
 * @returns {Promise<Object|null>} The user's health data or null if not found.
 * @throws Will throw an error if the request fails.
 */
export async function fetchHealthData() {
  const response = await fetch(`${API_BASE_URL}/health-data`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });

  if (!response.ok) {
    let errorMessage = 'Failed to fetch health data';
    try {
      const err = await response.json();
      errorMessage = err.error || errorMessage;
    } catch (jsonError) {
      const textError = await response.text().catch(() => '');
      errorMessage = textError || `Server error (status ${response.status})`;
    }
    throw new Error(errorMessage);
  }

  return await response.json();
}

