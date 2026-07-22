import axios from './axios'

export const authAPI = {
  login: (email, password) =>
    axios.post('/auth/login', { email, password }),
  getMe: () => axios.get('/auth/me'),
}

export const adminAPI = {
  // Officer CRUD
  registerOfficer: (formData) =>
    axios.post('/auth/officers', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  listOfficers:    ()         => axios.get('/auth/officers'),
  updateOfficer:   (id, data) => axios.patch(`/auth/officers/${id}`, data),
  toggleOfficer:   (id)       => axios.patch(`/auth/officers/${id}/toggle`),
  deleteOfficer:   (id)       => axios.delete(`/auth/officers/${id}`),
}

export const aqiAPI = {
  getCurrentAQI: (city) => axios.get(city ? `/aqi/current?city=${city}` : '/aqi/current'),
  getWardAQI: (wardId) => axios.get(`/aqi/ward/${wardId}`),
  getHeatmapData: (city) => axios.get(city ? `/aqi/heatmap?city=${city}` : '/aqi/heatmap'),
  getWardList: (city) => axios.get(city ? `/aqi/wards?city=${city}` : '/aqi/wards'),
  getCities: () => axios.get('/aqi/cities'),
  getHistoricalAQI: (wardId, days = 7) => axios.get(`/aqi/historical/${wardId}?days=${days}`),
}

export const predictionsAPI = {
  // horizon is a number (24, 72, 168) — map it to backend string format
  generatePrediction: (wardId, horizon) => {
    const horizonMap = { 24: '24h', 72: '3d', 168: '7d' }
    return axios.post('/predictions/generate', {
      ward_id: String(wardId),
      prediction_horizon: horizonMap[horizon] || '24h',
    })
  },
  getPredictions: (wardId) => axios.get(`/predictions/${wardId}`),
  getAccuracyMetrics: () => axios.get('/predictions/accuracy'),
}

export const hospitalsAPI = {
  getHospitals: () => axios.get('/hospitals'),
  getNearbyHospitals: (lat, lng, radius) =>
    axios.get(`/hospitals/nearby?lat=${lat}&lng=${lng}&radius_km=${radius}`),
}

export const healthAPI = {
  // Frontend sends {age_category, has_respiratory (bool), ward_id}
  // Backend schema: aqi_level required — fetch ward AQI from context or use default
  getRiskScore: (data) => {
    const langMap = { english: 'en', hindi: 'hi', gujarati: 'gu', en: 'en', hi: 'hi', gu: 'gu' }
    return axios.post('/health/risk-score', {
      aqi_level: data.aqi_level || 150,
      age_category: data.age_category,
      has_respiratory_condition: data.has_respiratory ?? data.has_respiratory_condition ?? false,
      ward_id: data.ward_id ? String(data.ward_id) : undefined,
      language: langMap[data.language] || 'en',
    })
  },
  getHealthAdvice: (data) => {
    const langMap = { english: 'en', hindi: 'hi', gujarati: 'gu', en: 'en', hi: 'hi', gu: 'gu' }
    return axios.post('/health/advice', {
      aqi_level: data.aqi_level || data.risk_score || 150,
      age_category: data.age_category,
      has_respiratory_condition: data.has_respiratory ?? data.has_respiratory_condition ?? false,
      ward_id: data.ward_id ? String(data.ward_id) : undefined,
      ward_name: data.ward_name || undefined,
      city: data.city || undefined,
      aqi_category: data.aqi_category || undefined,
      pm25: data.pm25,
      pm10: data.pm10,
      no2: data.no2,
      so2: data.so2,
      co: data.co,
      o3: data.o3,
      timestamp: data.timestamp,
      latitude: data.latitude,
      longitude: data.longitude,
      source: data.source,
      language: langMap[data.language] || 'en',
    })
  },
  getAdvisories: (userId) => axios.get(`/health/advisories/${userId}`),
}

export const hotspotsAPI = {
  getHotspots: (city) => axios.get(city ? `/hotspots/?city=${city}` : '/hotspots/'),
  getIndustries: (city) => axios.get(city ? `/hotspots/industries?city=${city}` : '/hotspots/industries'),
  getConstructionSites: (city) => axios.get(city ? `/hotspots/construction?city=${city}` : '/hotspots/construction'),
  getPriorityRanking: (city) => axios.get(city ? `/hotspots/priority-ranking?city=${city}` : '/hotspots/priority-ranking'),
}

export const governmentAPI = {
  getActions: (city) => axios.get(city ? `/government/actions?city=${city}` : '/government/actions'),
  updateActionStatus: (actionId, newStatus) => axios.patch(`/government/actions/${actionId}/status`, { status: newStatus }),
  // Map frontend-friendly fields to backend schema
  createAction: (data) => {
    const typeMap = {
      'Traffic Restriction': 'regulation',
      'Water Sprinkling': 'infrastructure',
      'Industrial Control': 'enforcement',
      'School Closure': 'regulation',
      'Public Advisory': 'awareness',
      'Tree Plantation': 'infrastructure',
    }
    return axios.post('/government/actions', {
      ward_id: data.ward || data.ward_id,
      action_type: typeMap[data.action_type] || 'regulation',
      description: data.description,
      priority: (data.priority || 'medium').toLowerCase(),
    })
  },
  getRecommendations: (city) => axios.get(city ? `/government/recommendations?city=${city}` : '/government/recommendations'),
  getWardRecommendations: (wardId) => axios.get(`/government/recommendations/ward/${wardId}`),
  // POST to /government/reports/generate
  generateReport: (wardId) => axios.post('/government/reports/generate', {
    ward_id: String(wardId),
  }),
  // GET /government/reports/:id/download  (streams PDF)
  downloadReport: (reportId) => axios.get(`/government/reports/${reportId}/download`, {
    responseType: 'blob',
  }),
  getReports: (city) => axios.get(city ? `/government/reports?city=${encodeURIComponent(city)}` : '/government/reports'),
}
