import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSocket } from '../contexts/SocketContext'
import { functionsApi, systemApi } from '../utils/api'
import { 
  Code, 
  Activity, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Upload
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

const Dashboard = () => {
  const [functions, setFunctions] = useState([])
  const [systemStatus, setSystemStatus] = useState(null)
  const [recentLogs, setRecentLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const { on } = useSocket()

  useEffect(() => {
    fetchData()

    // Listen for real-time updates
    on('function:loaded', (data) => {
      setFunctions(prev => {
        const existing = prev.find(f => f.name === data.name)
        if (existing) {
          return prev.map(f => f.name === data.name ? { ...f, ...data } : f)
        }
        return [...prev, data]
      })
    })

    on('function:unloaded', (data) => {
      setFunctions(prev => prev.filter(f => f.name !== data.name))
    })

    on('function:updated', (data) => {
      setFunctions(prev => 
        prev.map(f => f.name === data.name ? { ...f, ...data } : f)
      )
    })

    on('log:new', (log) => {
      setRecentLogs(prev => [log, ...prev.slice(0, 9)])
    })

    return () => {
      // Cleanup socket listeners
    }
  }, [on])

  const fetchData = async () => {
    try {
      const [functionsRes, statusRes, logsRes] = await Promise.all([
        functionsApi.getFunctions(),
        systemApi.getStatus(),
        systemApi.getLogs(10)
      ])
      
      setFunctions(functionsRes.data.functions || [])
      setSystemStatus(statusRes.data)
      setRecentLogs(logsRes.data.logs || [])
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'running':
        return 'text-success-600'
      case 'error':
        return 'text-danger-600'
      case 'stopped':
        return 'text-warning-600'
      default:
        return 'text-gray-600'
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Loading dashboard..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Overview of your FuncDock platform
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Code className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Total Functions
                </dt>
                <dd className="text-lg font-medium text-gray-900 dark:text-white">
                  {functions.length}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Activity className="h-6 w-6 text-success-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Running Functions
                </dt>
                <dd className="text-lg font-medium text-gray-900 dark:text-white">
                  {functions.filter(f => f.status === 'running').length}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-6 w-6 text-warning-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Errors
                </dt>
                <dd className="text-lg font-medium text-gray-900 dark:text-white">
                  {functions.filter(f => f.status === 'error').length}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Clock className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Uptime
                </dt>
                <dd className="text-lg font-medium text-gray-900 dark:text-white">
                  {systemStatus?.uptime ? `${Math.floor(systemStatus.uptime / 3600)}h` : 'N/A'}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Functions Overview */}
      <div className="card">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
              Functions
            </h3>
            <Link
              to="/functions"
              className="btn-primary text-sm"
            >
              View All
            </Link>
          </div>
          
          {functions.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <Code className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-base font-medium text-gray-900 dark:text-white mb-2">No functions yet</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Deploy your first function to get started
              </p>
              <Link
                to="/deploy"
                className="btn-primary text-sm inline-flex items-center"
              >
                <Upload className="h-4 w-4 mr-2" />
                Deploy Function
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden">
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {functions.slice(0, 5).map((func) => (
                  <li key={func.name} className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        {getStatusIcon(func.status)}
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {func.name}
                          </p>
                          <div className="flex items-center space-x-2">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {func.routes?.length || 0} routes
                            </p>
                            {func.routes && func.routes.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {Array.from(new Set(func.routes.map(route => route.method))).slice(0, 2).map((method) => (
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
                                {Array.from(new Set(func.routes.map(route => route.method))).length > 2 && (
                                  <span className="text-xs text-gray-400 dark:text-gray-500">
                                    +{Array.from(new Set(func.routes.map(route => route.method))).length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-sm ${getStatusColor(func.status)}`}>
                          {func.status}
                        </span>
                        <Link
                          to={`/functions/${func.name}`}
                          className="text-primary-600 hover:text-primary-500"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
            Recent Activity
          </h3>
          
          {recentLogs.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <Clock className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-base font-medium text-gray-900 dark:text-white mb-2">No recent activity</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Activity will appear here as your functions are executed and logs are generated.
              </p>
            </div>
          ) : (
            <div className="flow-root">
              <ul className="-mb-8">
                {recentLogs.map((log, logIdx) => (
                  <li key={logIdx}>
                    <div className="relative pb-8">
                      {logIdx !== recentLogs.length - 1 ? (
                        <span
                          className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200 dark:bg-gray-700"
                          aria-hidden="true"
                        />
                      ) : null}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center ring-8 ring-white dark:ring-gray-800">
                            <Activity className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {log.message}
                            </p>
                          </div>
                          <div className="text-right text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                            <time dateTime={log.timestamp}>
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </time>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard 