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
  Copy,
  Plus,
  Edit,
  X,
  Folder,
  File,
  ChevronRight,
  ChevronDown,
  Eye as EyeIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Trash2 as DeleteIcon
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
  
  // New state for cron jobs management
  const [cronJobs, setCronJobs] = useState([])
  const [editingCron, setEditingCron] = useState(false)
  const [newCronJob, setNewCronJob] = useState({
    name: '',
    schedule: '',
    handler: 'cron-handler.js',
    timezone: 'UTC',
    description: ''
  })
  const [editingCronIndex, setEditingCronIndex] = useState(-1)
  
  // New state for file explorer
  const [functionFiles, setFunctionFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileContent, setFileContent] = useState('')
  const [fileLoading, setFileLoading] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState(new Set())

  // New state for environment variables
  const [envVars, setEnvVars] = useState(null)
  const [envLoading, setEnvLoading] = useState(false)

  const [logLevel, setLogLevel] = useState('all')

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

  useEffect(() => {
    if (activeTab === 'env') {
      setEnvLoading(true)
      functionsApi.getEnv(name)
        .then(res => setEnvVars(res.data.env || {}))
        .catch(() => setEnvVars({}))
        .finally(() => setEnvLoading(false))
    }
  }, [activeTab, name])

  const fetchFunctionData = async () => {
    try {
      const [functionRes, logsRes, metricsRes, cronRes, filesRes] = await Promise.all([
        functionsApi.getFunction(name),
        functionsApi.getLogs(name, 50),
        functionsApi.getMetrics(name),
        functionsApi.getCronJobs(name),
        functionsApi.getFunctionFiles(name)
      ])
      
      setFunctionData(functionRes.data)
      // Parse each log line as JSON if possible
      const rawLogs = logsRes.data.logs || []
      const parsedLogs = rawLogs.map(line => {
        if (typeof line === 'object' && line !== null) return line
        try {
          return JSON.parse(line)
        } catch {
          return { message: line, level: 'INFO', timestamp: '', isPlain: true }
        }
      })
      setLogs(parsedLogs)
      setMetrics(metricsRes.data)
      setCronJobs(cronRes.data.jobs || [])
      setFunctionFiles(filesRes.data.files || [])
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

  // Cron job management functions
  const handleAddCronJob = () => {
    setEditingCron(true)
    setEditingCronIndex(-1)
    setNewCronJob({
      name: '',
      schedule: '',
      handler: 'cron-handler.js',
      timezone: 'UTC',
      description: ''
    })
  }

  const handleEditCronJob = (index) => {
    setEditingCron(true)
    setEditingCronIndex(index)
    setNewCronJob({ ...cronJobs[index] })
  }

  const handleDeleteCronJob = (index) => {
    const updatedJobs = cronJobs.filter((_, i) => i !== index)
    setCronJobs(updatedJobs)
  }

  const handleSaveCronJob = async () => {
    if (!newCronJob.name || !newCronJob.schedule || !newCronJob.handler) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      let updatedJobs
      if (editingCronIndex >= 0) {
        // Editing existing job
        updatedJobs = [...cronJobs]
        updatedJobs[editingCronIndex] = newCronJob
      } else {
        // Adding new job
        updatedJobs = [...cronJobs, newCronJob]
      }

      await functionsApi.updateCronJobs(name, updatedJobs)
      setCronJobs(updatedJobs)
      setEditingCron(false)
      setEditingCronIndex(-1)
      toast.success('Cron jobs updated successfully')
    } catch (error) {
      console.error('Failed to update cron jobs:', error)
      toast.error('Failed to update cron jobs')
    }
  }

  const handleCancelCronEdit = () => {
    setEditingCron(false)
    setEditingCronIndex(-1)
    setNewCronJob({
      name: '',
      schedule: '',
      handler: 'cron-handler.js',
      timezone: 'UTC',
      description: ''
    })
  }

  // File explorer functions
  const handleFileClick = async (file) => {
    if (file.type === 'directory') {
      const newExpanded = new Set(expandedFolders)
      if (newExpanded.has(file.path)) {
        newExpanded.delete(file.path)
      } else {
        newExpanded.add(file.path)
      }
      setExpandedFolders(newExpanded)
    } else {
      setSelectedFile(file)
      setFileLoading(true)
      try {
        const response = await functionsApi.getFileContent(name, file.path)
        setFileContent(response.data.content)
      } catch (error) {
        console.error('Failed to load file content:', error)
        toast.error('Failed to load file content')
        setFileContent('Error loading file content')
      } finally {
        setFileLoading(false)
      }
    }
  }

  const handleDownloadFile = async (file) => {
    try {
      const response = await functionsApi.downloadFile(name, file.path)
      const url = window.URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = file.name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('File downloaded successfully')
    } catch (error) {
      console.error('Failed to download file:', error)
      toast.error('Failed to download file')
    }
  }

  const renderFileTree = (files, level = 0) => {
    return files.map((file) => {
      const isExpanded = expandedFolders.has(file.path)
      const hasChildren = file.children && file.children.length > 0
      
      return (
        <div key={file.path}>
          <div 
            className={`flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
              selectedFile?.path === file.path ? 'bg-blue-50 dark:bg-blue-900/20' : ''
            }`}
            style={{ paddingLeft: `${level * 20 + 12}px` }}
            onClick={() => handleFileClick(file)}
          >
            {file.type === 'directory' ? (
              <>
                {hasChildren ? (
                  isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-400 mr-2" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400 mr-2" />
                  )
                ) : (
                  <div className="w-4 mr-2" />
                )}
                <Folder className="h-4 w-4 text-blue-500 mr-2" />
              </>
            ) : (
              <File className="h-4 w-4 text-gray-500 mr-2" />
            )}
            <span className="text-sm text-gray-900 dark:text-white">{file.name}</span>
            {file.type === 'file' && (
              <div className="ml-auto flex items-center space-x-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleFileClick(file)
                  }}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  title="View file"
                >
                  <EyeIcon className="h-3 w-3 text-gray-500" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDownloadFile(file)
                  }}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  title="Download file"
                >
                  <DownloadIcon className="h-3 w-3 text-gray-500" />
                </button>
              </div>
            )}
          </div>
          {file.type === 'directory' && isExpanded && hasChildren && (
            <div>{renderFileTree(file.children, level + 1)}</div>
          )}
        </div>
      )
    })
  }

  // Filter logs by selected log level
  const filteredLogs = logs.filter(log => {
    if (logLevel !== 'all' && log.level !== logLevel) return false
    return true
  })

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
            <DeleteIcon className="h-4 w-4 mr-1" />
            Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: EyeIcon },
            { id: 'routes', label: 'Routes', icon: Code },
            { id: 'cron', label: 'Cron Jobs', icon: Calendar },
            { id: 'files', label: 'Files', icon: Folder },
            { id: 'logs', label: 'Logs', icon: FileText },
            { id: 'metrics', label: 'Metrics', icon: Activity },
            { id: 'test', label: 'Test', icon: TestTube },
            { id: 'env', label: 'Env', icon: Settings },
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
                                // The route.path already includes the full path with function name
                                const fullUrl = window.location.origin + route.path;
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
                            {window.location.origin}{route.path}
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Cron Jobs</h3>
                <button
                  onClick={handleAddCronJob}
                  className="btn-primary btn-sm flex items-center"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Cron Job
                </button>
              </div>

              {/* Cron Job Editor */}
              {editingCron && (
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    {editingCronIndex >= 0 ? 'Edit Cron Job' : 'Add New Cron Job'}
                  </h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Job Name *
                      </label>
                      <input
                        type="text"
                        value={newCronJob.name}
                        onChange={(e) => setNewCronJob({ ...newCronJob, name: e.target.value })}
                        className="input mt-1"
                        placeholder="daily-backup"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Schedule (Cron Expression) *
                      </label>
                      <input
                        type="text"
                        value={newCronJob.schedule}
                        onChange={(e) => setNewCronJob({ ...newCronJob, schedule: e.target.value })}
                        className="input mt-1"
                        placeholder="0 9 * * *"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Format: minute hour day month day-of-week
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Handler File *
                      </label>
                      <input
                        type="text"
                        value={newCronJob.handler}
                        onChange={(e) => setNewCronJob({ ...newCronJob, handler: e.target.value })}
                        className="input mt-1"
                        placeholder="cron-handler.js"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Timezone
                      </label>
                      <input
                        type="text"
                        value={newCronJob.timezone}
                        onChange={(e) => setNewCronJob({ ...newCronJob, timezone: e.target.value })}
                        className="input mt-1"
                        placeholder="UTC"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Description
                      </label>
                      <textarea
                        value={newCronJob.description}
                        onChange={(e) => setNewCronJob({ ...newCronJob, description: e.target.value })}
                        className="input mt-1"
                        rows={2}
                        placeholder="What does this cron job do?"
                      />
                    </div>
                  </div>
                  
                  {/* Cron Examples */}
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h5 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">Common Cron Examples:</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setNewCronJob({ ...newCronJob, schedule: '0 9 * * *' })}
                          className="font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                        >
                          0 9 * * *
                        </button>
                        <span className="text-blue-700 dark:text-blue-300">Daily at 9 AM</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setNewCronJob({ ...newCronJob, schedule: '0 */6 * * *' })}
                          className="font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                        >
                          0 */6 * * *
                        </button>
                        <span className="text-blue-700 dark:text-blue-300">Every 6 hours</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setNewCronJob({ ...newCronJob, schedule: '0 0 * * 0' })}
                          className="font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                        >
                          0 0 * * 0
                        </button>
                        <span className="text-blue-700 dark:text-blue-300">Weekly on Sunday</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setNewCronJob({ ...newCronJob, schedule: '*/15 * * * *' })}
                          className="font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                        >
                          */15 * * * *
                        </button>
                        <span className="text-blue-700 dark:text-blue-300">Every 15 minutes</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end space-x-2 mt-4">
                    <button
                      onClick={handleCancelCronEdit}
                      className="btn-secondary btn-sm"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveCronJob}
                      className="btn-primary btn-sm"
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </button>
                  </div>
                </div>
              )}

              {/* Cron Jobs List */}
              {cronJobs.length > 0 ? (
                <div className="space-y-3">
                  {cronJobs.map((job, idx) => (
                    <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <span className="font-medium text-gray-900 dark:text-white mr-3">{job.name}</span>
                            <span className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm">{job.schedule}</span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Handler: <span className="font-mono">{job.handler}</span>
                            {job.timezone && (
                              <span className="ml-2">• Timezone: {job.timezone}</span>
                            )}
                          </p>
                          {job.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{job.description}</p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 mt-3 sm:mt-0">
                          <button
                            onClick={() => handleEditCronJob(idx)}
                            className="btn-secondary btn-xs"
                            title="Edit cron job"
                          >
                            <Edit className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteCronJob(idx)}
                            className="btn-danger btn-xs"
                            title="Delete cron job"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
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
                    This function doesn't have any scheduled cron jobs. Add cron jobs to schedule automated tasks.
                  </p>
                  <button
                    onClick={handleAddCronJob}
                    className="btn-primary btn-sm inline-flex items-center"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Cron Job
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Files Tab */}
          {activeTab === 'files' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Function Files</h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* File Tree */}
                <div className="lg:col-span-1">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">File Explorer</h4>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {functionFiles.length > 0 ? (
                        renderFileTree(functionFiles)
                      ) : (
                        <div className="p-4 text-center">
                          <Folder className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-500 dark:text-gray-400">No files found</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* File Content Viewer */}
                <div className="lg:col-span-2">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        {selectedFile ? selectedFile.name : 'File Content'}
                      </h4>
                      {selectedFile && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleDownloadFile(selectedFile)}
                            className="btn-secondary btn-xs flex items-center"
                            title="Download file"
                          >
                            <DownloadIcon className="h-3 w-3 mr-1" />
                            Download
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      {selectedFile ? (
                        fileLoading ? (
                          <div className="flex items-center justify-center h-32">
                            <LoadingSpinner size="sm" text="Loading file..." />
                          </div>
                        ) : (
                          <div className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                            <pre className="text-sm text-gray-900 dark:text-white p-4 overflow-x-auto max-h-96 overflow-y-auto">
                              {fileContent}
                            </pre>
                          </div>
                        )
                      ) : (
                        <div className="text-center py-12">
                          <File className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                          <h3 className="text-base font-medium text-gray-900 dark:text-white mb-2">No file selected</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Select a file from the explorer to view its content
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Function Logs</h3>
                <div className="flex items-center space-x-2">
                  <label className="text-xs text-gray-500 dark:text-gray-400 mr-1">Limit-Debug:</label>
                  <select
                    value={logs.length}
                    onChange={(e) => fetchFunctionData()}
                    className="input text-sm"
                  >
                    <option value={50}>Last 50</option>
                    <option value={100}>Last 100</option>
                    <option value={200}>Last 200</option>
                  </select>
                  <label className="text-xs text-gray-500 dark:text-gray-400 ml-2 mr-1">Level-Debug:</label>
                  <select
                    value={logLevel}
                    onChange={e => setLogLevel(e.target.value)}
                    className="input text-sm"
                  >
                    <option value="all">All Levels</option>
                    <option value="ERROR">ERROR</option>
                    <option value="WARN">WARN</option>
                    <option value="INFO">INFO</option>
                    <option value="ACCESS">ACCESS</option>
                  </select>
                  <button
                    onClick={() => fetchFunctionData()}
                    className="btn-secondary text-sm ml-2"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </button>
                </div>
              </div>
              {filteredLogs.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left px-2 py-1">Timestamp</th>
                        <th className="text-left px-2 py-1">Level</th>
                        <th className="text-left px-2 py-1">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log, index) => (
                        <tr key={index}>
                          <td className="font-mono px-2 py-1">{log.timestamp || ''}</td>
                          <td className="font-mono px-2 py-1">{log.level || ''}</td>
                          <td className="font-mono px-2 py-1">{log.message || (typeof log === 'string' ? log : '')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <File className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="text-base font-medium text-gray-900 dark:text-white mb-2">No logs found</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No logs available for this function
                  </p>
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

          {/* Env Tab */}
          {activeTab === 'env' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Environment Variables</h3>
              {envLoading ? (
                <div className="flex items-center justify-center h-32">
                  <LoadingSpinner size="sm" text="Loading environment variables..." />
                </div>
              ) : envVars && Object.keys(envVars).length > 0 ? (
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left px-2 py-1">Key</th>
                        <th className="text-left px-2 py-1">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(envVars).map(([key, value]) => (
                        <tr key={key}>
                          <td className="font-mono px-2 py-1 text-gray-900 dark:text-white">{key}</td>
                          <td className="font-mono px-2 py-1 text-gray-700 dark:text-gray-300">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No environment variables found for this function.
                </div>
              )}
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