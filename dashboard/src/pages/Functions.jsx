import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
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
  Upload,
  ExternalLink
} from 'lucide-react'
import LoadingSpinner, { SkeletonLoader } from '../components/LoadingSpinner'
import toast from 'react-hot-toast'

const PAGE_SIZE = 24;

const Functions = () => {
  const [functions, setFunctions] = useState([])
  const [loading, setLoading] = useState(true)
  const { on } = useSocket()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetchFunctions()

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

    return () => {
      // Cleanup socket listeners
    }
  }, [on])

  const fetchFunctions = async () => {
    try {
      const response = await functionsApi.getFunctions()
      setFunctions(response.data.functions || [])
    } catch (error) {
      console.error('Failed to fetch functions:', error)
      toast.error('Failed to load functions')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteFunction = async (name) => {
    if (!confirm(`Are you sure you want to delete the function "${name}"?`)) {
      return
    }

    try {
      await functionsApi.deleteFunction(name)
      toast.success(`Function "${name}" deleted successfully`)
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

  // Memoized, sorted, filtered functions
  const filteredFunctions = useMemo(() => {
    return functions
      .filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [functions, search])

  const totalPages = Math.ceil(filteredFunctions.length / PAGE_SIZE)
  const paginatedFunctions = filteredFunctions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Reset to page 1 if search changes
  useEffect(() => { setPage(1) }, [search])

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Functions</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage your serverless functions
            </p>
          </div>
          <div className="w-32 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
        </div>
        {/* Search bar skeleton */}
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse w-64 mb-2"></div>
        {/* Skeleton Loader */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonLoader type="card" count={6} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Functions</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your serverless functions
          </p>
        </div>
        <Link
          to="/deploy"
          className="btn-primary"
        >
          Deploy Function
        </Link>
      </div>

      {/* Search Filter */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search functions..."
          className="input w-64"
        />
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {filteredFunctions.length} function{filteredFunctions.length !== 1 ? 's' : ''} found
        </div>
      </div>

      {/* Functions Grid */}
      {filteredFunctions.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
            <Code className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No functions deployed yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
            Get started by deploying your first serverless function. You can deploy from local files or directly from a Git repository.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/deploy"
              className="btn-primary inline-flex items-center"
            >
              <Upload className="h-4 w-4 mr-2" />
              Deploy Your First Function
            </Link>
            <a
              href="https://github.com/your-repo/funcdock#quick-start"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary inline-flex items-center"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Documentation
            </a>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedFunctions.map((func) => (
              <div key={func.name} className="card">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      {getStatusIcon(func.status)}
                      <h3 className="ml-2 text-lg font-medium text-gray-900 dark:text-white">
                        {func.name}
                      </h3>
                    </div>
                    <span className={`badge ${getStatusColor(func.status)}`}>
                      {func.status}
                    </span>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Routes:</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-900 dark:text-white font-medium">
                          {func.routes?.length || 0}
                        </span>
                        {func.routes && func.routes.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {Array.from(new Set(func.routes.map(route => route.method))).slice(0, 3).map((method) => (
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
                            {Array.from(new Set(func.routes.map(route => route.method))).length > 3 && (
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                +{Array.from(new Set(func.routes.map(route => route.method))).length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Cron Jobs:</span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        {func.cronJobs || 0}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Last Deployed:</span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        {func.lastDeployed ? new Date(func.lastDeployed).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Link
                      to={`/functions/${func.name}`}
                      className="flex-1 btn-secondary inline-flex items-center justify-center"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Link>
                    <button
                      onClick={() => handleDeleteFunction(func.name)}
                      className="btn-danger inline-flex items-center justify-center"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center mt-6 space-x-2">
              <button
                className="btn-secondary px-3 py-1"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  className={`btn-secondary px-3 py-1 ${page === i + 1 ? 'bg-primary-600 text-white' : ''}`}
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
              <button
                className="btn-secondary px-3 py-1"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Functions 