import { useEffect, useState } from 'react'
import { healthAPI, aqiAPI } from '../../api'
import HealthRiskGauge from '../../components/charts/HealthRiskGauge'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { HeartIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { useCityStore, filterWardsByCity } from '../../store/cityStore'

const LANGUAGES = [
  { value: 'english',  label: 'English'  },
  { value: 'hindi',    label: 'Hindi'    },
  { value: 'gujarati', label: 'Gujarati' },
]

const mockAdvice = {
  english: {
    activity:    'Avoid prolonged outdoor activities. Moderate indoor exercise is fine. Elderly and children should stay indoors.',
    mask:        'Wear an N95/KN95 mask outdoors. Regular surgical masks offer insufficient protection against PM2.5 particles.',
    precautions: 'Keep windows closed. Use an air purifier if available. Stay hydrated. Watch for coughing or throat irritation.',
  },
  hindi: {
    activity:    'लंबे समय तक बाहरी गतिविधियों से बचें। घर के अंदर हल्का व्यायाम ठीक है। बुजुर्ग और बच्चे घर पर रहें।',
    mask:        'बाहर जाने पर N95/KN95 मास्क पहनें। सामान्य सर्जिकल मास्क PM2.5 कणों से पर्याप्त सुरक्षा नहीं देते।',
    precautions: 'खिड़कियां बंद रखें। उपलब्ध हो तो एयर प्यूरीफायर उपयोग करें। पानी पर्याप्त पियें।',
  },
  gujarati: {
    activity:    'લાંબા સમય સુધી બહારની પ્રવૃત્તિઓ ટાળો. ઘરની અંદર હળવી કસરત ઠીક છે. વૃદ્ધો અને બાળકો ઘરે રહો.',
    mask:        'બહાર જતી વખતે N95/KN95 માસ્ક પહેરો. સામાન્ય સર્જિકલ માસ્ક PM2.5 સામે પૂરતું રક્ષણ આપતા નથી.',
    precautions: 'બારીઓ બંધ રાખો. ઉપલબ્ધ હોય તો એર પ્યુરિફાયર વાપરો. પૂરતું પાણી પીઓ.',
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
  const [language, setLang]   = useState('english')

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

              {advice && (
                <div className="glass-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                      Health Advisory
                    </h2>
                    <select
                      className="input-field !w-32 !py-1 text-sm"
                      value={language}
                      onChange={e => setLang(e.target.value)}
                    >
                      {LANGUAGES.map(l => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-3">
                    {[
                      { key: 'activity',    label: '🏃 Activity',    content: advice.activity    },
                      { key: 'mask',        label: '😷 Mask Usage',  content: advice.mask        },
                      { key: 'precautions', label: '⚠️ Precautions', content: advice.precautions },
                    ].filter(({ content }) => content).map(({ key, label, content }) => (
                      <div key={key} className="p-3 bg-gray-800/50 rounded-xl border border-gray-700/30">
                        <p className="text-xs font-semibold text-gray-300 mb-1.5">{label}</p>
                        <p className="text-sm text-gray-300 leading-relaxed">{content}</p>
                      </div>
                    ))}
                  </div>
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
