export default function LoadingSpinner({ text = 'Loading...', size = 'md', className = '' }) {
  const sizeClass = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  }[size] || 'w-8 h-8'

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className={`${sizeClass} border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin`} />
      {text && <p className="text-gray-400 text-sm">{text}</p>}
    </div>
  )
}
