import React, { useState, useEffect } from 'react'
import { useSocket } from '../contexts/SocketContext'
import { systemApi, functionsApi } from '../utils/api'
import { 
  FileText, 
  Filter, 
  Download, 
  RefreshCw, 
  Play, 
  Pause,
  Search,
  Clock,
  AlertTriangle,
  Info,
  XCircle
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'

const Logs = () => {
  const [logs, setLogs] = useState([])
  const [functions, setFunctions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedFunction, setSelectedFunction] = useState('all')
  const [logLevel, setLogLevel] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [isLive, setIsLive] = useState(false)
  const [limit, setLimit] = useState(100)
  const { on } = useSocket()

  useEffect(() => {
    fetchLogs()
    fetchFunctions()

    // Listen for real-time log updates
    on('log:new', (log) => {
      if (isLive) {
        setLogs(prev => [log, ...prev.slice(0, limit - 1)])
      }
    })

    return () => {
      // Cleanup socket listeners
    }
  }, [on, isLive, limit])

  const fetchLogs = async () => {
    try {
      const response = await systemApi.getLogs(limit)
      setLogs(response.data.logs || [])
    } catch (error) {
      console.error('Failed to fetch logs:', error)
      toast.error('Failed to load logs')
    } finally {
      setLoading(false)
    }
  }

  const fetchFunctions = async () => {
    try {
      const response = await functionsApi.getFunctions()
      setFunctions(response.data.functions || [])
    } catch (error) {
      console.error('Failed to fetch functions:', error)
    }
  }

  const handleExportLogs = () => {
    const filteredLogs = getFilteredLogs()
    const csvContent = [
      'Timestamp,Level,Function,Message',
      ...filteredLogs.map(log => {
        const timestamp = log.timestamp || ''
        const level = log.level || 'INFO'
        const func = log.function || 'system'
        const message = (log.message || '').replace(/"/g, '""')
        return `"${timestamp}","${level}","${func}","${message}"`
      })
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `funcdock-logs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const getFilteredLogs = () => {
    return logs.filter(log => {
      // Filter by function
      if (selectedFunction !== 'all' && log.function !== selectedFunction) {
        return false
      }
      
      // Filter by log level
      if (logLevel !== 'all' && log.level !== logLevel) {
        return false
      }
      
      // Filter by search term
      if (searchTerm && !log.message.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }
      
      return true
    })
  }

  const getLogLevelIcon = (level) => {
    switch (level) {
      case 'ERROR':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'WARN':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'INFO':
        return <Info className="h-4 w-4 text-blue-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getLogLevelColor = (level) => {
    switch (level) {
      case 'ERROR':
        return 'text-red-600 bg-red-50 dark:bg-red-900/20'
      case 'WARN':
        return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20'
      case 'INFO':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20'
      default:
        return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20'
    }
  }

  const filteredLogs = getFilteredLogs()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Logs</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            System and function logs
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={fetchLogs}
            className="btn-secondary"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </button>
          <button
            onClick={handleExportLogs}
            className="btn-secondary"
          >
            <Download className="h-4 w-4 mr-1" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Function Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Function
              </label>
              <select
                value={selectedFunction}
                onChange={(e) => setSelectedFunction(e.target.value)}
                className="input"
              >
                <option value="all">All Functions</option>
                {functions.map((func) => (
                  <option key={func.name} value={func.name}>
                    {func.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Log Level Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Log Level
              </label>
              <select
                value={logLevel}
                onChange={(e) => setLogLevel(e.target.value)}
                className="input"
              >
                <option value="all">All Levels</option>
                <option value="ERROR">Error</option>
                <option value="WARN">Warning</option>
                <option value="INFO">Info</option>
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-10"
                  placeholder="Search logs..."
                />
              </div>
            </div>

            {/* Limit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Limit
              </label>
              <select
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                className="input"
              >
                <option value={50}>50 logs</option>
                <option value={100}>100 logs</option>
                <option value={200}>200 logs</option>
                <option value={500}>500 logs</option>
              </select>
            </div>

            {/* Live Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Live Mode
              </label>
              <button
                onClick={() => setIsLive(!isLive)}
                className={`w-full px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                  isLive
                    ? 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/20 dark:text-green-400 dark:border-green-700'
                    : 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
                }`}
              >
                {isLive ? (
                  <>
                    <Pause className="h-4 w-4 inline mr-1" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 inline mr-1" />
                    Live
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Logs Display */}
      <div className="card">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Logs ({filteredLogs.length})
            </h3>
            {isLive && (
              <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                Live
              </div>
            )}
          </div>

          {filteredLogs.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No logs found</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Try adjusting your filters or search terms.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredLogs.map((log, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${getLogLevelColor(log.level)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      {getLogLevelIcon(log.level)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 text-sm">
                          <span className="font-mono text-xs">
                            {new Date(log.timestamp || Date.now()).toLocaleString()}
                          </span>
                          {log.function && (
                            <>
                              <span className="text-gray-400">•</span>
                              <span className="font-medium">{log.function}</span>
                            </>
                          )}
                          {log.level && (
                            <>
                              <span className="text-gray-400">•</span>
                              <span className="font-medium">{log.level}</span>
                            </>
                          )}
                        </div>
                        <p className="mt-1 text-sm font-mono break-words">
                          {log.message || JSON.stringify(log)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Log Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center">
            <FileText className="h-6 w-6 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Logs</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{logs.length}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center">
            <XCircle className="h-6 w-6 text-red-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Errors</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {logs.filter(log => log.level === 'ERROR').length}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Warnings</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {logs.filter(log => log.level === 'WARN').length}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center">
            <Info className="h-6 w-6 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Info</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {logs.filter(log => log.level === 'INFO').length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Logs 