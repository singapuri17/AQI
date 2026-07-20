import { useEffect, useState } from 'react'
import { governmentAPI, aqiAPI } from '../../api'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { DocumentTextIcon, ArrowDownTrayIcon, DocumentChartBarIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { useCityStore } from '../../store/cityStore'

const WARDS_BY_CITY = {
  Ahmedabad: ['AMD_W01','AMD_W02','AMD_W03','AMD_W04','AMD_W05','AMD_W06','AMD_W07','AMD_W08','AMD_W09','AMD_W10','AMD_W11','AMD_W12','AMD_W13','AMD_W14','AMD_W15','AMD_W16','AMD_W17','AMD_W18','AMD_W19','AMD_W20'],
  Surat:     ['SRT_W01','SRT_W02','SRT_W03','SRT_W04','SRT_W05','SRT_W06','SRT_W07','SRT_W08','SRT_W09','SRT_W10','SRT_W11','SRT_W12','SRT_W13','SRT_W14','SRT_W15'],
  Vadodara:  ['VDR_W01','VDR_W02','VDR_W03','VDR_W04','VDR_W05','VDR_W06','VDR_W07','VDR_W08','VDR_W09','VDR_W10','VDR_W11','VDR_W12','VDR_W13','VDR_W14','VDR_W15'],
}

const MOCK_REPORTS = [
  {
    id: 1, ward_id: 'Naroda', title: 'Naroda AQI Compliance Report — June 2024',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    summary: 'Ward Naroda exceeded AQI limits on 18/30 days. PM2.5 averaged 89 μg/m³, 3.6x safe limit. Primary sources: textile mills (42%), vehicle exhaust (28%). Recommended immediate industrial emission controls.',
    status: 'ready',
  },
  {
    id: 2, ward_id: 'Vatva', title: 'Vatva Chemical Zone Report — June 2024',
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    summary: 'Chemical GIDC area showed dangerous SO₂ and NO₂ concentrations. 12 incidents of AQI > 200. Emergency response protocols activated twice. Compliance notices issued to 4 industrial units.',
    status: 'ready',
  },
  {
    id: 3, ward_id: 'Odhav', title: 'Odhav Monthly Environmental Report',
    created_at: new Date(Date.now() - 8 * 86400000).toISOString(),
    summary: 'Moderate improvement from previous month (-8 AQI avg). Water sprinkling interventions showed 12% reduction in PM10. Further industrial controls required for SO₂ compliance.',
    status: 'ready',
  },
]

export default function ReportsPage() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [wards, setWards] = useState([])
  const [selectedWard, setSelectedWard] = useState('')
  const [previewReport, setPreviewReport] = useState(null)
  const { selectedCity } = useCityStore()

  // Load ward list for selected city from backend
  useEffect(() => {
    aqiAPI.getWardList(selectedCity).then(res => {
      const list = Array.isArray(res.data) ? res.data : []
      setWards(list)
      if (list.length > 0) setSelectedWard(list[0].ward_id)
    }).catch(() => {
      // fallback to static list
      const fallback = (WARDS_BY_CITY[selectedCity] || []).map(id => ({ ward_id: id, ward_name: id }))
      setWards(fallback)
      if (fallback.length > 0) setSelectedWard(fallback[0].ward_id)
    })
  }, [selectedCity])

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true)
      try {
        const res = await governmentAPI.getReports()
        const data = res.data
        setReports(Array.isArray(data) ? data : MOCK_REPORTS)
      } catch {
        setReports(MOCK_REPORTS)
      } finally {
        setLoading(false)
      }
    }
    fetchReports()
  }, [])

  const handleGenerate = async (e) => {
    e.preventDefault()
    setGenerating(true)
    try {
      const res = await governmentAPI.generateReport(selectedWard)
      const newReport = res.data
      setReports(prev => [newReport, ...prev])
      toast.success(`Report generated for ${selectedWard}`)
      if (newReport) setPreviewReport(newReport)
    } catch (err) {
      const detail = err?.response?.data?.detail
      toast.error(detail ? `Generation failed: ${detail}` : `Failed to generate report for ${selectedWard}`)
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = async (report) => {
    // Mock/demo reports have no real server-side PDF — show a friendly message
    if (!report.download_url && typeof report.id === 'number' && report.id > 1000000) {
      toast.error('PDF download is only available for server-generated reports. Generate a new report to download a real PDF.')
      return
    }
    try {
      const res = await governmentAPI.downloadReport(report.id)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${report.title || 'report'}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Report downloaded')
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Download failed'
      toast.error(`Download failed: ${msg}`)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <DocumentTextIcon className="w-6 h-6 text-purple-400" />
          Evidence Reports
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">Generate and download AI-powered environmental compliance reports</p>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-5">Generate New Report</h2>
        <form onSubmit={handleGenerate} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="label-text">Select Ward</label>
            <select
              className="input-field"
              value={selectedWard}
              onChange={e => setSelectedWard(e.target.value)}
            >
              {wards.map(w => (
                <option key={w.ward_id} value={w.ward_id}>{w.ward_name}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={generating}
            className="btn-primary flex items-center gap-2 py-2.5"
          >
            {generating ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</>
            ) : (
              <><DocumentChartBarIcon className="w-4 h-4" />Generate Report</>
            )}
          </button>
        </form>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            Generated Reports ({reports.length})
          </h2>
          {loading ? (
            <LoadingSpinner size="sm" text="Loading reports..." className="py-8" />
          ) : reports.length === 0 ? (
            <div className="py-8 text-center">
              <DocumentTextIcon className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No reports generated yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  onClick={() => setPreviewReport(report)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all hover:border-purple-500/30 ${
                    previewReport?.id === report.id ? 'border-purple-500/50 bg-purple-500/5' : 'border-gray-700/50 bg-gray-800/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white mb-0.5">{report.title}</p>
                      <p className="text-xs text-gray-400">
                        {format(new Date(report.created_at), 'MMM d, yyyy HH:mm')}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownload(report) }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600/30 transition-colors text-xs font-medium flex-shrink-0"
                    >
                      <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                      PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Report Preview</h2>
          {previewReport ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-white">{previewReport.title}</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Generated {format(new Date(previewReport.created_at), 'MMMM d, yyyy')} · Ward: {previewReport.ward || previewReport.ward_id}
                </p>
              </div>
              <div className="h-px bg-gray-700" />
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Executive Summary</h4>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {previewReport.summary ||
                    `Environmental compliance and air quality report for ${previewReport.ward || previewReport.ward_id} ward. ` +
                    `Analysis covers PM2.5, PM10, NO₂, SO₂, CO, and O₃ concentrations. This report includes ` +
                    `trend analysis, source attribution, and recommended interventions based on 30-day monitoring data.`}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/30">
                  <p className="text-xs text-gray-400">Report Type</p>
                  <p className="text-sm font-medium text-white mt-0.5">Compliance & AQI</p>
                </div>
                <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/30">
                  <p className="text-xs text-gray-400">Status</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium mt-1 inline-block">
                    {previewReport.status || 'Ready'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleDownload(previewReport)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600/30 transition-colors text-sm font-medium"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                Download Full Report (PDF)
              </button>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <DocumentTextIcon className="w-12 h-12 text-gray-600 mb-3" />
              <p className="text-gray-300 font-medium">No report selected</p>
              <p className="text-gray-500 text-sm mt-1">Click a report from the list to preview it</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
