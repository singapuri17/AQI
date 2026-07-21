import axios from './axios'

export const authAPI = {
  login: (email, password) =>
    axios.post('/auth/login', { email, password }),
  getMe: () => axios.get('/auth/me'),
}

export const adminAPI = {
  // Register a new OFFICER (multipart so the document file can be included)
  registerOfficer: (formData) =>
    axios.post('/auth/officers', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  listOfficers: ()              => axios.get('/auth/officers'),
  deleteOfficer: (id)           => axios.delete(`/auth/officers/${id}`),
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
      language: langMap[data.language] || 'en',
    })
  },
  getAdvisories: (userId) => axios.get(`/health/advisories/${userId}`),
}

export const hotspotsAPI = {
  getHotspots: () => axios.get('/hotspots'),
  getIndustries: () => axios.get('/hotspots/industries'),
  getConstructionSites: () => axios.get('/hotspots/construction'),
  getPriorityRanking: () => axios.get('/hotspots/priority-ranking'),
}

export const governmentAPI = {
  getActions: () => axios.get('/government/actions'),
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
  getRecommendations: () => axios.get('/government/recommendations'),
  // POST to /government/reports/generate
  generateReport: (wardId) => axios.post('/government/reports/generate', {
    ward_id: String(wardId),
  }),
  // GET /government/reports/:id/download  (streams PDF)
  downloadReport: (reportId) => axios.get(`/government/reports/${reportId}/download`, {
    responseType: 'blob',
  }),
  getReports: () => axios.get('/government/reports'),
}
