import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useSocket } from '../contexts/SocketContext'
import { functionsApi } from '../utils/api'
import { 
  Code, 
  Play, 
  Trash2, 
  Settings, 
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  FileText,
  GitBranch,
  Calendar,
  TestTube,
  Download,
  Upload,
  RefreshCw,
  ExternalLink,
  Copy
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'

const FunctionDetail = () => {
  const { name } = useParams()
  const [functionData, setFunctionData] = useState(null)
  const [logs, setLogs] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [testData, setTestData] = useState({
    method: 'GET',
    path: '/',
    data: '',
    headers: ''
  })
  const [testResult, setTestResult] = useState(null)
  const [testLoading, setTestLoading] = useState(false)
  const [updateFiles, setUpdateFiles] = useState([])
  const { on } = useSocket()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchFunctionData()

    // Listen for real-time updates
    on('function:updated', (data) => {
      if (data.name === name) {
        setFunctionData(prev => ({ ...prev, ...data }))
      }
    })

    return () => {
      // Cleanup socket listeners
    }
  }, [name, on])

  const fetchFunctionData = async () => {
    try {
      const [functionRes, logsRes, metricsRes] = await Promise.all([
        functionsApi.getFunction(name),
        functionsApi.getLogs(name, 50),
        functionsApi.getMetrics(name)
      ])
      
      setFunctionData(functionRes.data)
      setLogs(logsRes.data.logs || [])
      setMetrics(metricsRes.data)
    } catch (error) {
      console.error('Failed to fetch function data:', error)
      toast.error('Failed to load function data')
    } finally {
      setLoading(false)
    }
  }

  const handleTestFunction = async () => {
    setTestLoading(true)
    try {
      const response = await functionsApi.testFunction(
        name,
        testData.method,
        testData.data ? JSON.parse(testData.data) : null
      )
      setTestResult(response.data)
      toast.success('Function test completed')
    } catch (error) {
      console.error('Test failed:', error)
      toast.error('Function test failed')
    } finally {
      setTestLoading(false)
    }
  }

  const handleUpdateFunction = async () => {
    if (updateFiles.length === 0) {
      toast.error('Please select files to update')
      return
    }

    try {
      await functionsApi.updateFunction(name, updateFiles)
      toast.success('Function updated successfully')
      fetchFunctionData()
      setUpdateFiles([])
    } catch (error) {
      console.error('Update failed:', error)
      toast.error('Failed to update function')
    }
  }

  const handleDeleteFunction = async () => {
    if (!confirm(`Are you sure you want to delete the function "${name}"?`)) {
      return
    }

    try {
      await functionsApi.deleteFunction(name)
      toast.success(`Function "${name}" deleted successfully`)
      // Redirect to functions list
      window.location.href = '/functions'
    } catch (error) {
      console.error('Failed to delete function:', error)
      toast.error('Failed to delete function')
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="h-5 w-5 text-success-600" />
      case 'error':
        return <XCircle className="h-5 w-5 text-danger-600" />
      case 'stopped':
        return <AlertTriangle className="h-5 w-5 text-warning-600" />
      default:
        return <Clock className="h-5 w-5 text-gray-600" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'running':
        return 'badge-success'
      case 'error':
        return 'badge-danger'
      case 'stopped':
        return 'badge-warning'
      default:
        return 'badge-info'
    }
  }

  // Copy function URL to clipboard
  const handleCopyUrl = () => {
    if (functionData?.baseUrl) {
      const url = window.location.origin + functionData.baseUrl
      navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Loading function details..." />
      </div>
    )
  }

  if (!functionData) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Function not found</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          The function "{name}" could not be found.
        </p>
        <div className="mt-6">
          <Link to="/functions" className="btn-primary">
            Back to Functions
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center">
            {getStatusIcon(functionData.status)}
            <h1 className="ml-2 text-2xl font-bold text-gray-900 dark:text-white">
              {functionData.name}
            </h1>
            <span className={`ml-3 badge ${getStatusColor(functionData.status)}`}>
              {functionData.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Function details and management
          </p>
          {functionData.baseUrl && (
            <div className="mt-2 flex items-center space-x-2">
              <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                {window.location.origin}{functionData.baseUrl}
              </span>
              <button
                onClick={handleCopyUrl}
                className="btn-secondary btn-xs flex items-center"
                title="Copy URL"
              >
                <Copy className="h-4 w-4" />
                {copied ? <span className="ml-1 text-green-600">Copied!</span> : null}
              </button>
            </div>
          )}
        </div>
        <div className="flex space-x-2">
          <button
            onClick={fetchFunctionData}
            className="btn-secondary"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </button>
          <button
            onClick={handleDeleteFunction}
            className="btn-danger"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: Eye },
            { id: 'routes', label: 'Routes', icon: Code },
            { id: 'cron', label: 'Cron Jobs', icon: Calendar },
            { id: 'logs', label: 'Logs', icon: FileText },
            { id: 'metrics', label: 'Metrics', icon: Activity },
            { id: 'test', label: 'Test', icon: TestTube },
            { id: 'update', label: 'Update', icon: Upload }
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="h-4 w-4 mr-1" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="card">
        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <div className="flex items-center">
                    <Code className="h-6 w-6 text-primary-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Routes</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {functionData.routes?.length || 0}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <div className="flex items-center">
                    <Calendar className="h-6 w-6 text-success-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Cron Jobs</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {Array.isArray(functionData.cronJobs) ? functionData.cronJobs.length : (functionData.cronJobs || 0)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <div className="flex items-center">
                    <Activity className="h-6 w-6 text-warning-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Invocations</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {metrics?.invocations || 0}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <div className="flex items-center">
                    <Clock className="h-6 w-6 text-info-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Deployed</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {functionData.lastDeployed ? new Date(functionData.lastDeployed).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Function Information</h3>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{functionData.name}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{functionData.status}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Path</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{functionData.path || 'N/A'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Handler</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{functionData.handler || 'handler.js'}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          )}

          {/* Routes Tab */}
          {activeTab === 'routes' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Function Routes</h3>
              
              {/* Routes Summary */}
              {functionData.routes && functionData.routes.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Routes</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{functionData.routes.length}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Available Methods</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Array.from(new Set(functionData.routes.map(route => route.method))).map((method) => (
                          <span 
                            key={method} 
                            className={`badge text-xs ${
                              method === 'GET' ? 'badge-success' :
                              method === 'POST' ? 'badge-primary' :
                              method === 'PUT' ? 'badge-warning' :
                              method === 'DELETE' ? 'badge-danger' :
                              method === 'PATCH' ? 'badge-info' :
                              method === 'OPTIONS' ? 'badge-secondary' :
                              'badge-info'
                            }`}
                          >
                            {method}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Base URL</p>
                      <p className="text-sm font-mono text-gray-900 dark:text-white mt-1">
                        {window.location.origin}{functionData.baseUrl || ''}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {functionData.routes && functionData.routes.length > 0 ? (
                <div className="space-y-4">
                  {functionData.routes.map((route, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="space-y-3">
                        {/* Route Path and Full URL */}
                        <div>
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {route.path || '/'}
                            </h4>
                            <button
                              onClick={() => {
                                const fullUrl = window.location.origin + (functionData.baseUrl || '') + (route.path || '/');
                                navigator.clipboard.writeText(fullUrl);
                                toast.success('URL copied to clipboard');
                              }}
                              className="btn-secondary btn-xs flex items-center"
                              title="Copy full URL"
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy URL
                            </button>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded mt-1">
                            {window.location.origin}{functionData.baseUrl || ''}{route.path || '/'}
                          </p>
                        </div>

                        {/* HTTP Methods */}
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">HTTP Method:</p>
                          <div className="flex flex-wrap gap-2">
                            <span 
                              className={`badge text-xs font-medium ${
                                route.method === 'GET' ? 'badge-success' :
                                route.method === 'POST' ? 'badge-primary' :
                                route.method === 'PUT' ? 'badge-warning' :
                                route.method === 'DELETE' ? 'badge-danger' :
                                route.method === 'PATCH' ? 'badge-info' :
                                route.method === 'OPTIONS' ? 'badge-secondary' :
                                'badge-info'
                              }`}
                            >
                              {route.method}
                            </span>
                          </div>
                        </div>

                        {/* Handler Information */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-600">
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Handler: <span className="font-mono text-gray-900 dark:text-white">{route.handler || 'handler.js'}</span>
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              Route #{index + 1}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="mx-auto w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                    <Code className="h-10 w-10 text-gray-400" />
                  </div>
                  <h3 className="text-base font-medium text-gray-900 dark:text-white mb-2">No routes configured</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    This function doesn't have any routes configured yet. Add routes to your route.config.json file.
                  </p>
                  <div className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 p-3 rounded font-mono">
                    Example: {"{"}"path": "/", "methods": ["GET", "POST"]{"}"}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cron Jobs Tab */}
          {activeTab === 'cron' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Cron Jobs</h3>
              {Array.isArray(functionData.cronJobs) && functionData.cronJobs.length > 0 ? (
                <div className="space-y-3">
                  {functionData.cronJobs.map((job, idx) => (
                    <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            <span className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded mr-2">{job.schedule}</span>
                            <span className="text-xs text-gray-500 ml-2">{job.handler}</span>
                          </p>
                          {job.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{job.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="mx-auto w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                    <Calendar className="h-10 w-10 text-gray-400" />
                  </div>
                  <h3 className="text-base font-medium text-gray-900 dark:text-white mb-2">No cron jobs configured</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    This function doesn't have any scheduled cron jobs. Add a cron.json file to schedule automated tasks.
                  </p>
                  <div className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 p-3 rounded font-mono">
                    Example: {"{"}"jobs": [{"{"}"schedule": "0 */6 * * *", "handler": "cron-handler.js"{"}"}]{"}"}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Function Logs</h3>
                <div className="flex items-center space-x-2">
                  <select
                    value={logs.length}
                    onChange={(e) => fetchFunctionData()}
                    className="input text-sm"
                  >
                    <option value={50}>Last 50</option>
                    <option value={100}>Last 100</option>
                    <option value={200}>Last 200</option>
                  </select>
                  <button
                    onClick={() => fetchFunctionData()}
                    className="btn-secondary text-sm"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </button>
                </div>
              </div>
              {logs.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {logs.map((log, index) => (
                    <div key={index} className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">
                          {new Date(log.timestamp || Date.now()).toLocaleString()}
                        </span>
                        {log.level && (
                          <span className={`badge text-xs ${
                            log.level === 'ERROR' ? 'badge-danger' :
                            log.level === 'WARN' ? 'badge-warning' : 'badge-info'
                          }`}>
                            {log.level}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-900 dark:text-white mt-1">
                        {log.message || JSON.stringify(log)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="mx-auto w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                    <FileText className="h-10 w-10 text-gray-400" />
                  </div>
                  <h3 className="text-base font-medium text-gray-900 dark:text-white mb-2">No logs available</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    Logs will appear here when the function is executed. Try testing the function to generate some logs.
                  </p>
                  <button
                    onClick={() => setActiveTab('test')}
                    className="btn-secondary text-sm inline-flex items-center"
                  >
                    <TestTube className="h-4 w-4 mr-2" />
                    Test Function
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Metrics Tab */}
          {activeTab === 'metrics' && metrics && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Function Metrics</h3>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Invocations</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.invocations}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Errors</p>
                  <p className="text-2xl font-bold text-red-600">{metrics.errors}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Response Time</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.avgResponseTime?.toFixed(2)}ms</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Invocation</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {metrics.lastInvocation ? new Date(metrics.lastInvocation).toLocaleString() : 'N/A'}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Routes</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.routes?.length || 0}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Cron Jobs</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.cronJobs}</p>
                </div>
              </div>
            </div>
          )}

          {/* Test Tab */}
          {activeTab === 'test' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Test Function</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      HTTP Method
                    </label>
                    <select
                      value={testData.method}
                      onChange={(e) => setTestData({ ...testData, method: e.target.value })}
                      className="input mt-1"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                      <option value="PATCH">PATCH</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Path
                    </label>
                    <input
                      type="text"
                      value={testData.path}
                      onChange={(e) => setTestData({ ...testData, path: e.target.value })}
                      className="input mt-1"
                      placeholder="/"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Request Body (JSON)
                  </label>
                  <textarea
                    value={testData.data}
                    onChange={(e) => setTestData({ ...testData, data: e.target.value })}
                    className="input mt-1"
                    rows={4}
                    placeholder='{"key": "value"}'
                  />
                </div>
                <button
                  onClick={handleTestFunction}
                  disabled={testLoading}
                  className="btn-primary"
                >
                  {testLoading ? (
                    <>
                      <LoadingSpinner size="sm" type="dots" text="Testing..." />
                    </>
                  ) : (
                    <>
                      <TestTube className="h-4 w-4 mr-1" />
                      Test Function
                    </>
                  )}
                </button>

                {testResult && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Test Result</h4>
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`badge ${testResult.success ? 'badge-success' : 'badge-danger'}`}>
                          {testResult.success ? 'Success' : 'Error'}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Status: {testResult.statusCode}
                        </span>
                      </div>
                      <pre className="text-sm text-gray-900 dark:text-white overflow-x-auto">
                        {JSON.stringify(testResult.response || testResult.error, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Update Tab */}
          {activeTab === 'update' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Update Function</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Function Files
                  </label>
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
                    <div className="text-center">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="mt-4">
                        <label htmlFor="update-file-upload" className="btn-primary cursor-pointer">
                          <FileText className="h-4 w-4 mr-2" />
                          Select Files
                        </label>
                        <input
                          id="update-file-upload"
                          type="file"
                          multiple
                          onChange={(e) => setUpdateFiles(Array.from(e.target.files))}
                          className="hidden"
                          accept=".js,.json,.txt,.md,.yml,.yaml"
                        />
                      </div>
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        Upload updated function files
                      </p>
                    </div>
                  </div>
                </div>

                {updateFiles.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Selected Files ({updateFiles.length})
                    </h4>
                    <div className="space-y-2">
                      {updateFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                          <div className="flex items-center">
                            <FileText className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900 dark:text-white">{file.name}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleUpdateFunction}
                  disabled={updateFiles.length === 0}
                  className="btn-primary"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Update Function
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default FunctionDetail 