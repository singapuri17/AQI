import { useEffect, useState } from 'react'
import { healthAPI, aqiAPI } from '../../api'
import HealthRiskGauge from '../../components/charts/HealthRiskGauge'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { HeartIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { useCityStore, filterWardsByCity } from '../../store/cityStore'
import { getAQICategory, getRiskBgClass, formatAQI } from '../../utils/aqiUtils'

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'gu', label: 'Gujarati' },
]

const mockAdvice = {
  en: {
    overall_summary: 'Air quality is elevated in your selected ward today. Priority is reducing outdoor exposure and controlling indoor air sources for your health.',
    pollution_analysis: {
      primary_pollutant: 'PM2.5',
      why_aqi_dangerous: 'Fine particulates are the main contributor and can penetrate deep into the lungs, increasing respiratory strain.',
      elevated_pollutants: [
        { pollutant: 'PM2.5', value: 85, unit: 'µg/m³', health_impact: 'Can worsen asthma and cause throat irritation.' },
        { pollutant: 'PM10', value: 110, unit: 'µg/m³', health_impact: 'May irritate airways and increase coughing.' },
      ],
    },
    activity_recommendation: {
      recommendation: 'Avoid strenuous outdoor activities and keep outdoor time brief.',
      reasoning: 'Higher particulate levels increase breathing stress, especially during exertion.',
    },
    mask_recommendation: {
      mask_type: 'N95/KN95',
      reasoning: 'A respirator provides better protection against fine particles than a regular mask.',
    },
    indoor_safety: {
      windows: 'Keep windows closed while pollution remains high.',
      air_purifier: 'Use an air purifier if available.',
      hydration: 'Stay well hydrated to support your airways.',
      other_recommendations: ['Avoid indoor smoke sources.', 'Ventilate briefly only when air quality improves.'],
      reasoning: 'Indoor air is easier to control, so reduce indoor sources and keep the home environment safer.',
    },
    personalized_health_risk: {
      risk_level: 'High',
      explanation: 'Your profile and the current pollutant levels make respiratory irritation more likely.',
      sensitive_population_warnings: ['Respiratory conditions increase risk from PM2.5.', 'Elderly and children are more vulnerable to fine particulates.'],
    },
    symptoms_to_watch: ['Coughing', 'Wheezing', 'Shortness of breath', 'Chest tightness', 'Eye irritation'],
    emergency_warning: {
      active: false,
      message: 'Move indoors if symptoms appear and seek medical help if they worsen.',
      when_to_seek_care: 'If breathing trouble persists even after moving indoors, consult a doctor.',
    },
    long_term_advice: ['Monitor AQI before planning outdoor activities.', 'Exercise indoors when pollution is poor.', 'Limit repeated exposure on high AQI days.'],
    extra: { source: 'fallback', generated_by: 'Local advisory engine' },
  },
  hi: {
    overall_summary: 'आपकी चुनी हुई वार्ड में आज वायु गुणवत्ता ऊँची है। बाहरी संपर्क कम रखें और घर के अंदर हवा को नियंत्रित करें।',
    pollution_analysis: {
      primary_pollutant: 'PM2.5',
      why_aqi_dangerous: 'सूक्ष्म कण फेफड़ों में गहराई तक पहुंच सकते हैं और श्वसन पर दबाव बढ़ा सकते हैं।',
      elevated_pollutants: [
        { pollutant: 'PM2.5', value: 85, unit: 'µg/m³', health_impact: 'यह अस्थमा को बढ़ा सकता है और गले को परेशान कर सकता है।' },
      ],
    },
    activity_recommendation: {
      recommendation: 'बाहर की गतिविधियों को सीमित रखें और तेज व्यायाम से बचें।',
      reasoning: 'उच्च प्रदूषण स्तर श्वास प्रणाली पर अधिक दबाव डालते हैं।',
    },
    mask_recommendation: {
      mask_type: 'N95/KN95',
      reasoning: 'सूक्ष्म कणों के खिलाफ बेहतर सुरक्षा के लिए respirator जरूरी है।',
    },
    indoor_safety: {
      windows: 'जब तक प्रदूषण बना रहे, खिड़कियाँ बंद रखें।',
      air_purifier: 'यदि उपलब्ध हो तो एयर प्यूरीफायर चलाएँ।',
      hydration: 'अपनी वायुमार्ग को आराम देने के लिए पर्याप्त पानी पिएँ।',
      other_recommendations: ['घर के अंदर धूम्रपान से बचें।', 'हवा साफ होने पर हल्का वेंटिलेशन करें।'],
      reasoning: 'घर के अंदर हवा नियंत्रित करना आसान है, इसलिए स्रोतों को कम रखें।',
    },
    personalized_health_risk: {
      risk_level: 'High',
      explanation: 'आपकी प्रोफ़ाइल और वायु की स्थिति से श्वसन समस्याओं का जोखिम बढ़ता है।',
      sensitive_population_warnings: ['अन्य श्वसन स्थितियों से जोखिम और अधिक बढ़ता है।'],
    },
    symptoms_to_watch: ['खाँसी', 'सीटी की आवाज', 'साँस लेने में कठिनाई', 'छाती में दबाव', 'आँखों में जलन'],
    emergency_warning: {
      active: false,
      message: 'यदि लक्षण बढ़ें तो अंदर जाएँ और चिकित्सकीय सहायता लें।',
      when_to_seek_care: 'यदि सांस लेने में कठिनाई बनी रहे, तो डॉक्टर से मिलें।',
    },
    long_term_advice: ['खराब AQI वाले दिनों में बाहर जाने से पहले AQI देखें।', 'उच्च प्रदूषण पर घर के अंदर व्यायाम करें।', 'बार-बार संपर्क कम करें।'],
    extra: { source: 'fallback', generated_by: 'Local advisory engine' },
  },
  gu: {
    overall_summary: 'તમારા પસંદ કરેલા વિસ્તારમાં આજે હવાની ગુણવત્તા ઊંચી છે. બહારના સંપર્કને ઓછું રાખો અને અંદરના હવા સ્ત્રોતો નિયંત્રિત કરો.',
    pollution_analysis: {
      primary_pollutant: 'PM2.5',
      why_aqi_dangerous: 'નાના કણો ફેફસાં સુધી પહોંચીને શ્વાસ પર વધુ ભાર મૂકી શકે છે.',
      elevated_pollutants: [
        { pollutant: 'PM2.5', value: 85, unit: 'µg/m³', health_impact: 'આ શ્વાસને વધુ મુશ્કેલ બનાવી શકે છે અને ગળામાં જલન કરી શકે છે.' },
      ],
    },
    activity_recommendation: {
      recommendation: 'બહારની પ્રવૃતિઓ સીમિત રાખો અને ભારે કસરતથી બચો.',
      reasoning: 'ઉચ્ચ પ્રદૂષણ સ્તર શ્વસન તંત્ર પર તણાવ વધારી શકે છે.',
    },
    mask_recommendation: {
      mask_type: 'N95/KN95',
      reasoning: 'સૂક્ષ્મ કણો માટે ઉત્તમ રક્ષણ માટે respirator મહત્વપૂર્ણ છે.',
    },
    indoor_safety: {
      windows: 'પ્રદૂષણ ચાલુ રહે ત્યાં સુધી બારીઓ બંધ રાખો.',
      air_purifier: 'હવી હોય તો એર શુદ્ધિકરણ યંત્રનો ઉપયોગ કરો.',
      hydration: 'તમારા વાયુ માર્ગોને આરામ આપવા માટે પૂરતું પાણી પીઓ.',
      other_recommendations: ['અંદરના ધૂમ્રપાનથી દૂર રહો.', 'હવા સાફ થતી વખતે હળવી રીતે હવામાન કરો.'],
      reasoning: 'અંદરની હવાને નિયંત્રિત કરવી સરળ છે, તેથી સ્ત્રોતોને ઘટાવો.',
    },
    personalized_health_risk: {
      risk_level: 'High',
      explanation: 'તમારી પ્રોફાઇલ અને પ્રદૂષણની સ્થિતિ શ્વસન સમસ્યાઓનું જોખમ વધારશે.',
      sensitive_population_warnings: ['શ્વાસની હાલત સાથે જોખમ વધે છે.'],
    },
    symptoms_to_watch: ['ખાંસી', 'શ્વાસ લેવામાં તકલીફ', 'સ્તન દબાણ', 'આંખોમાં જલન', 'ઉધરસ'],
    emergency_warning: {
      active: false,
      message: 'જો લક્ષણો વધે તો અંદર જાઓ અને તબીબની સલાહ લો.',
      when_to_seek_care: 'જો શ્વાસ લેવામાં તકલીફ સતત રહે, તો ડોક્ટર સાથે સંપર્ક કરો.',
    },
    long_term_advice: ['બદમાશ AQI દિવસોમાં બહારનું સંપર્ક ઓછું કરો.', 'ઉચ્ચ પ્રદૂષણ પર અંદર કસરત કરો.', 'બહાર જતાં પહેલાં AQI તપાસો.'],
    extra: { source: 'fallback', generated_by: 'Local advisory engine' },
  },
}

export default function HealthRiskPage() {
  const { selectedCity }  = useCityStore()
  const [cityWards, setCityWards]   = useState([])
  const [wardsLoading, setWardsLoading] = useState(true)

  const [form, setForm] = useState({
    age_category: 'adult',
    respiratory:  false,
    ward_id:      '',    // will be set after wards load
  })
  const [result, setResult]   = useState(null)
  const [advice, setAdvice]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [language, setLang]   = useState('en')

  const structuredAdvice = advice?.advice ?? advice

  // ── Load wards for the selected city ──────────────────────────────
  useEffect(() => {
    let cancelled = false
    const loadWards = async () => {
      setWardsLoading(true)
      setResult(null)
      setAdvice(null)
      try {
        const res  = await aqiAPI.getCurrentAQI(selectedCity)
        const all  = Array.isArray(res.data) ? res.data : []
        const city = filterWardsByCity(all, selectedCity)
        if (!cancelled) {
          setCityWards(city)
          setForm(f => ({ ...f, ward_id: city[0]?.ward_id ?? '' }))
        }
      } catch {
        if (!cancelled) {
          setCityWards([])
          setForm(f => ({ ...f, ward_id: '' }))
        }
      } finally {
        if (!cancelled) setWardsLoading(false)
      }
    }
    loadWards()
    return () => { cancelled = true }
  }, [selectedCity])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    // Look up the current AQI for the chosen ward
    const chosenWard = cityWards.find(w => w.ward_id === form.ward_id)
    const wardAQI    = chosenWard?.aqi_value ?? chosenWard?.aqi ?? 150

    try {
      const riskRes = await healthAPI.getRiskScore({
        aqi_level:      wardAQI,
        age_category:   form.age_category,
        has_respiratory: form.respiratory,
        ward_id:        form.ward_id,
      })
      setResult(riskRes.data)

      try {
        const adviceRes = await healthAPI.getHealthAdvice({
          aqi_level:      wardAQI,
          age_category:   form.age_category,
          has_respiratory: form.respiratory,
          ward_id:        form.ward_id,
          ward_name:      chosenWard?.ward_name,
          city:           selectedCity,
          aqi_category:   chosenWard?.aqi_category || getAQICategory(wardAQI).label,
          pm25:           chosenWard?.pm25,
          pm10:           chosenWard?.pm10,
          no2:            chosenWard?.no2,
          so2:            chosenWard?.so2,
          co:             chosenWard?.co,
          o3:             chosenWard?.o3,
          timestamp:      chosenWard?.timestamp,
          latitude:       chosenWard?.latitude,
          longitude:      chosenWard?.longitude,
          source:         chosenWard?.source,
          language,
        })
        setAdvice(adviceRes.data)
      } catch {
        setAdvice(mockAdvice[language])
      }
      toast.success('Risk assessment complete')
    } catch {
      const score    = form.respiratory ? 72 : form.age_category === 'child' ? 65 : form.age_category === 'elderly' ? 78 : 45
      const category = score >= 75 ? 'Severe' : score >= 50 ? 'High' : score >= 25 ? 'Moderate' : 'Low'
      setResult({ risk_score: score, risk_category: category, ward_aqi: wardAQI })
      setAdvice(mockAdvice[language])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <HeartIcon className="w-6 h-6 text-red-400" />
          Health Risk Assessment
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">
          Personalised risk based on your profile and current AQI in{' '}
          <span className="text-white font-medium">{selectedCity}</span>
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ── Form ── */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-5">
            Your Profile
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Age category */}
            <div>
              <label className="label-text">Age Category</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'child',   label: 'Child',   emoji: '👶', desc: 'Under 12' },
                  { value: 'adult',   label: 'Adult',   emoji: '🧑', desc: '12–60'    },
                  { value: 'elderly', label: 'Elderly', emoji: '👴', desc: 'Over 60'  },
                ].map(({ value, label, emoji, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, age_category: value }))}
                    className={clsx(
                      'p-3 rounded-lg border text-center transition-all',
                      form.age_category === value
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    )}
                  >
                    <p className="text-xl mb-1">{emoji}</p>
                    <p className="text-xs font-semibold text-white">{label}</p>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Ward selector — city-specific */}
            <div>
              <label className="label-text">
                Select Ward · <span className="text-blue-400">{selectedCity}</span>
              </label>
              {wardsLoading ? (
                <div className="input-field flex items-center gap-2 text-gray-400 text-sm">
                  <span className="w-3 h-3 border-2 border-gray-500 border-t-gray-300 rounded-full animate-spin" />
                  Loading wards…
                </div>
              ) : (
                <select
                  className="input-field"
                  value={form.ward_id}
                  onChange={e => setForm(f => ({ ...f, ward_id: e.target.value }))}
                >
                  {cityWards.map(w => (
                    <option key={w.ward_id} value={w.ward_id}>
                      {w.ward_name ?? w.name ?? w.ward_id}
                    </option>
                  ))}
                  {cityWards.length === 0 && (
                    <option disabled value="">No wards available</option>
                  )}
                </select>
              )}
              {/* Show current AQI for the chosen ward */}
              {form.ward_id && !wardsLoading && (() => {
                const w = cityWards.find(x => x.ward_id === form.ward_id)
                const aqi = w?.aqi_value ?? w?.aqi
                return aqi != null ? (
                  <p className="text-xs text-gray-400 mt-1">
                    Current AQI: <span className="text-white font-semibold">{Math.round(aqi)}</span>
                  </p>
                ) : null
              })()}
            </div>

            {/* Respiratory toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
              <div>
                <p className="text-sm font-medium text-white">Respiratory Conditions</p>
                <p className="text-xs text-gray-400 mt-0.5">Asthma, COPD, or similar</p>
              </div>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, respiratory: !f.respiratory }))}
                className={clsx(
                  'relative w-11 h-6 rounded-full transition-colors',
                  form.respiratory ? 'bg-blue-600' : 'bg-gray-600'
                )}
              >
                <span className={clsx(
                  'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                  form.respiratory && 'translate-x-5'
                )} />
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || wardsLoading || !form.ward_id}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <ShieldCheckIcon className="w-5 h-5" />
                  Assess My Risk
                </>
              )}
            </button>
          </form>
        </div>

        {/* ── Results ── */}
        <div className="space-y-4">
          {result ? (
            <>
              <div className="glass-card p-6">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                  Your Risk Score
                </h2>
                <div className="flex flex-col items-center">
                  <HealthRiskGauge score={result.risk_score} category={result.risk_category} size={220} />
                </div>
                {result.ward_aqi != null && (
                  <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50 text-center">
                    <p className="text-xs text-gray-400">Current Ward AQI</p>
                    <p className="text-xl font-bold text-white">{Math.round(result.ward_aqi)}</p>
                  </div>
                )}
              </div>

              {structuredAdvice ? (
                <div className="glass-card p-5 space-y-6">
                  <div className="flex items-center justify-between mb-3 gap-4">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                        AI Health Advisory
                      </h2>
                      <p className="text-xs text-gray-400 mt-1">
                        Tailored to your profile and current ward air quality.
                      </p>
                    </div>
                    <select
                      className="input-field !w-36 !py-1 text-sm"
                      value={language}
                      onChange={e => setLang(e.target.value)}
                    >
                      {LANGUAGES.map(l => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-3xl border border-gray-700/60 bg-gray-900/60 p-5">
                    <p className="text-sm text-slate-300">Overall Health Summary</p>
                    <p className="mt-2 text-white text-lg font-semibold leading-7">
                      {structuredAdvice.overall_summary}
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-3xl border border-gray-700/60 bg-gray-900/60 p-5">
                      <p className="text-sm text-slate-300 mb-3">Pollution Analysis</p>
                      <p className="text-white font-semibold">Primary contributor: {structuredAdvice.pollution_analysis.primary_pollutant}</p>
                      <p className="text-sm text-gray-300 mt-2">{structuredAdvice.pollution_analysis.why_aqi_dangerous}</p>
                      <div className="mt-4 space-y-3">
                        {(structuredAdvice.pollution_analysis.elevated_pollutants || []).map(item => (
                          <div key={item.pollutant} className="rounded-2xl bg-gray-800/90 p-3 border border-gray-700">
                            <p className="text-xs text-gray-400 uppercase tracking-[0.15em]">{item.pollutant}</p>
                            <p className="text-sm text-white font-semibold">{item.value} {item.unit}</p>
                            <p className="text-xs text-gray-400 mt-1">{item.health_impact}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-gray-700/60 bg-gray-900/60 p-5">
                      <p className="text-sm text-slate-300 mb-3">Personalized Health Risk</p>
                      <p className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getRiskBgClass(structuredAdvice.personalized_health_risk.risk_level)}`}>
                        {structuredAdvice.personalized_health_risk.risk_level}
                      </p>
                      <p className="text-sm text-gray-300 mt-3">{structuredAdvice.personalized_health_risk.explanation}</p>
                      <ul className="mt-4 list-disc pl-5 text-sm text-gray-400 space-y-1">
                        {(structuredAdvice.personalized_health_risk.sensitive_population_warnings || []).map((warning, idx) => (
                          <li key={idx}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-3xl border border-gray-700/60 bg-gray-900/60 p-5">
                      <p className="text-sm text-slate-300 mb-3">Activity Recommendation</p>
                      <p className="text-white font-semibold">{structuredAdvice.activity_recommendation.recommendation}</p>
                      <p className="text-sm text-gray-400 mt-2">{structuredAdvice.activity_recommendation.reasoning}</p>
                    </div>
                    <div className="rounded-3xl border border-gray-700/60 bg-gray-900/60 p-5">
                      <p className="text-sm text-slate-300 mb-3">Mask Recommendation</p>
                      <p className="text-white font-semibold">{structuredAdvice.mask_recommendation.mask_type}</p>
                      <p className="text-sm text-gray-400 mt-2">{structuredAdvice.mask_recommendation.reasoning}</p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-gray-700/60 bg-gray-900/60 p-5">
                    <p className="text-sm text-slate-300 mb-3">Indoor Safety</p>
                    <p className="text-white font-semibold">Windows: {structuredAdvice.indoor_safety.windows}</p>
                    <p className="text-white font-semibold mt-2">Air purifier: {structuredAdvice.indoor_safety.air_purifier}</p>
                    <p className="text-white font-semibold mt-2">Hydration: {structuredAdvice.indoor_safety.hydration}</p>
                    <div className="mt-3 space-y-2 text-sm text-gray-400">
                      {(structuredAdvice.indoor_safety.other_recommendations || []).map((item, idx) => (
                        <p key={idx}>• {item}</p>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-3">{structuredAdvice.indoor_safety.reasoning}</p>
                  </div>

                  <div className="rounded-3xl border border-gray-700/60 bg-gray-900/60 p-5">
                    <p className="text-sm text-slate-300 mb-3">Symptoms to Watch</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(structuredAdvice.symptoms_to_watch || []).map((symptom, idx) => (
                        <span key={idx} className="rounded-full bg-gray-800 px-3 py-2 text-xs text-gray-300">{symptom}</span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-red-500/50 bg-red-900/10 p-5">
                    <p className="text-sm text-red-300 uppercase tracking-[0.15em] mb-2">Emergency Warning</p>
                    <p className="text-white font-semibold">{structuredAdvice.emergency_warning?.message}</p>
                    <p className="text-sm text-gray-300 mt-2">{structuredAdvice.emergency_warning?.when_to_seek_care}</p>
                  </div>

                  <div className="rounded-3xl border border-gray-700/60 bg-gray-900/60 p-5">
                    <p className="text-sm text-slate-300 mb-3">Long-Term Advice</p>
                    <ul className="list-disc pl-5 text-sm text-gray-400 space-y-2">
                      {(structuredAdvice.long_term_advice || []).map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="glass-card p-5">
                  <div className="text-gray-300">No advisory data available.</div>
                </div>
              )}
            </>
          ) : (
            <div className="glass-card p-8 flex flex-col items-center justify-center text-center h-64">
              <HeartIcon className="w-12 h-12 text-gray-600 mb-3" />
              <p className="text-gray-300 font-medium">No assessment yet</p>
              <p className="text-gray-500 text-sm mt-1">
                Fill in your profile and click "Assess My Risk"
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
