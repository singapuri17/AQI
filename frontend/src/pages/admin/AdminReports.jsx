import { useEffect, useState } from 'react'
import { governmentAPI, aqiAPI } from '../../api'
import { CITIES_WITH_DATA } from '../../store/cityStore'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { DocumentTextIcon, ArrowDownTrayIcon, DocumentChartBarIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function AdminReports() {
  const [reports, setReports]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [wards, setWards]           = useState([])
  const [selectedWard, setWard]     = useState('')
  const [selectedCity, setCity]     = useState(CITIES_WITH_DATA[0])
  const [generating, setGenerating] = useState(false)
  const [preview, setPreview]       = useState(null)

  // Load wards when city changes
  useEffect(() => {
    setWards([]); setWard('')
    aqiAPI.getWardList(selectedCity).then(res => {
      const list = Array.isArray(res.data) ? res.data : []
      setWards(list)
      if (list.length > 0) setWard(list[0].ward_id)
    }).catch(() => {})
  }, [selectedCity])

  // Load all reports across all cities
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const results = await Promise.allSettled(
        CITIES_WITH_DATA.map(c => governmentAPI.getReports(c))
      )
      const all = results.flatMap((r, i) => {
        if (r.status !== 'fulfilled') return []
        const list = Array.isArray(r.value.data) ? r.value.data : []
        return list.map(rep => ({ ...rep, city: CITIES_WITH_DATA[i] }))
      })
      all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      setReports(all)
      setLoading(false)
    }
    load()
  }, [])

  const handleGenerate = async e => {
    e.preventDefault()
    if (!selectedWard) return
    setGenerating(true)
    try {
      const res = await governmentAPI.generateReport(selectedWard)
      const rep = { ...res.data, city: selectedCity }
      setReports(prev => [rep, ...prev])
      setPreview(rep)
      toast.success(`Report generated for ${selectedWard}`)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Generation failed.')
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = async rep => {
    if (typeof rep.id === 'number' && rep.id > 1e9) {
      toast.error('PDF only available for server-generated reports.')
      return
    }
    try {
      const res = await governmentAPI.downloadReport(rep.id)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `${rep.title || 'report'}.pdf`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
      toast.success('Downloaded')
    } catch {
      toast.error('Download failed.')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <DocumentTextIcon className="w-6 h-6 text-purple-400" />
          Reports
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">Generate and download evidence reports for any ward</p>
      </div>

      {/* Generator form */}
      <div className="glass-card p-6">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-5">Generate New Report</h2>
        <form onSubmit={handleGenerate} className="flex flex-wrap gap-4 items-end">
          {/* City selector */}
          <div className="min-w-[150px]">
            <label className="label-text">City</label>
            <div className="flex gap-1 bg-gray-800/60 rounded-lg p-1 border border-gray-700/50">
              {CITIES_WITH_DATA.map(c => (
                <button key={c} type="button" onClick={() => setCity(c)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    selectedCity === c ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}>{c}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="label-text">Ward</label>
            <select className="input-field" value={selectedWard} onChange={e => setWard(e.target.value)}>
              {wards.map(w => <option key={w.ward_id} value={w.ward_id}>{w.ward_name}</option>)}
            </select>
          </div>
          <button type="submit" disabled={generating || !selectedWard} className="btn-primary flex items-center gap-2 py-2.5">
            {generating
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating…</>
              : <><DocumentChartBarIcon className="w-4 h-4" />Generate Report</>}
          </button>
        </form>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Report list */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            All Reports ({reports.length})
          </h3>
          {loading ? (
            <LoadingSpinner size="sm" text="Loading…" className="py-8" />
          ) : reports.length === 0 ? (
            <div className="text-center py-8">
              <DocumentTextIcon className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No reports generated yet.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
              {reports.map(rep => (
                <div key={`${rep.city}-${rep.id}`}
                  onClick={() => setPreview(rep)}
                  className={clsx('p-4 rounded-xl border cursor-pointer transition-all hover:border-purple-500/30',
                    preview?.id === rep.id && preview?.city === rep.city
                      ? 'border-purple-500/50 bg-purple-500/5'
                      : 'border-gray-700/50 bg-gray-800/40')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{rep.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-purple-300">{rep.city}</span>
                        <span className="text-xs text-gray-500">{format(new Date(rep.created_at), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); handleDownload(rep) }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600/30 text-xs font-medium flex-shrink-0 transition-colors">
                      <ArrowDownTrayIcon className="w-3.5 h-3.5" />PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Preview</h3>
          {preview ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-purple-300 font-medium">{preview.city}</p>
                <h3 className="text-base font-bold text-white">{preview.title}</h3>
                <p className="text-xs text-gray-400 mt-1">
                  {format(new Date(preview.created_at), 'MMMM d, yyyy')} · {preview.ward_id}
                </p>
              </div>
              <div className="h-px bg-gray-700" />
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Summary</h4>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {preview.summary || `Environmental compliance and air quality analysis report for ${preview.ward_id}. Covers PM2.5, PM10, NO₂, SO₂, CO and O₃ concentrations, trend analysis, source attribution and recommended interventions based on 30-day monitoring data.`}
                </p>
              </div>
              <button onClick={() => handleDownload(preview)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600/30 text-sm font-medium transition-colors">
                <ArrowDownTrayIcon className="w-4 h-4" />Download Full Report (PDF)
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <DocumentTextIcon className="w-12 h-12 text-gray-600 mb-3" />
              <p className="text-gray-400 text-sm">Select a report to preview it</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
