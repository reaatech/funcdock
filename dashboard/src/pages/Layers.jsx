import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSocket } from '../contexts/SocketContext'
import { layersApi } from '../utils/api'
import { 
  Layers as LayersIcon, 
  Trash2, 
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Upload,
  Package,
  Users,
  List as ListIcon,
  LayoutGrid
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'

const PAGE_SIZE = 24;

const Layers = () => {
  const [layers, setLayers] = useState([])
  const [loading, setLoading] = useState(true)
  const { on } = useSocket()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [viewMode, setViewMode] = useState('card') // 'card' or 'list'

  useEffect(() => {
    fetchLayers()

    // Listen for real-time updates
    on('layer:deployed', (data) => {
      setLayers(prev => {
        const existing = prev.find(l => l.name === data.name)
        if (existing) {
          return prev.map(l => l.name === data.name ? { ...l, ...data } : l)
        }
        return [...prev, data]
      })
      fetchLayers() // Refresh to get full details
    })

    on('layer:updated', (data) => {
      setLayers(prev => 
        prev.map(l => l.name === data.name ? { ...l, ...data } : l)
      )
      fetchLayers() // Refresh to get full details
    })

    on('layer:deleted', (data) => {
      setLayers(prev => prev.filter(l => l.name !== data.name))
      toast.success(`Layer "${data.name}" was deleted`)
    })

    return () => {
      // Cleanup socket listeners
    }
  }, [on])

  const fetchLayers = async () => {
    try {
      const response = await layersApi.getLayers()
      setLayers(response.data.layers || [])
    } catch (error) {
      console.error('Failed to fetch layers:', error)
      toast.error('Failed to load layers')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteLayer = async (name) => {
    if (!confirm(`Are you sure you want to delete the layer "${name}"?`)) {
      return
    }

    try {
      await layersApi.deleteLayer(name)
      toast.success(`Layer "${name}" deleted successfully`)
    } catch (error) {
      console.error('Failed to delete layer:', error)
      const errorMsg = error.response?.data?.message || 'Failed to delete layer'
      toast.error(errorMsg)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'loaded':
        return <CheckCircle className="h-5 w-5 text-success-600" />
      case 'error':
        return <XCircle className="h-5 w-5 text-danger-600" />
      default:
        return <AlertTriangle className="h-5 w-5 text-warning-600" />
    }
  }

  const filteredLayers = useMemo(() => {
    if (!search) return layers
    const searchLower = search.toLowerCase()
    return layers.filter(layer => 
      layer.name.toLowerCase().includes(searchLower) ||
      (layer.description && layer.description.toLowerCase().includes(searchLower))
    )
  }, [layers, search])

  const totalPages = Math.ceil(filteredLayers.length / PAGE_SIZE)
  const paginatedLayers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredLayers.slice(start, start + PAGE_SIZE)
  }, [filteredLayers, page])

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <LayersIcon className="h-8 w-8 mr-3" />
            Layers
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage shared code layers for your functions
          </p>
        </div>
        <Link
          to="/deploy?type=layer"
          className="btn-primary inline-flex items-center"
        >
          <Upload className="h-5 w-5 mr-2" />
          Deploy Layer
        </Link>
      </div>

      {/* Search and View Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search layers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-full"
          />
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode('card')}
            className={`btn-secondary ${viewMode === 'card' ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`btn-secondary ${viewMode === 'list' ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
          >
            <ListIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Layers Grid/List */}
      {filteredLayers.length === 0 ? (
        <div className="text-center py-12">
          <LayersIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No layers found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {search ? 'Try adjusting your search' : 'Get started by deploying your first layer'}
          </p>
          {!search && (
            <Link to="/deploy?type=layer" className="btn-primary inline-flex items-center">
              <Upload className="h-5 w-5 mr-2" />
              Deploy Layer
            </Link>
          )}
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedLayers.map((layer) => (
            <div key={layer.name} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  {getStatusIcon(layer.status)}
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white ml-2">
                    {layer.name}
                  </h3>
                </div>
                <div className="flex items-center space-x-2">
                  <Link
                    to={`/layers/${layer.name}`}
                    className="btn-secondary btn-sm"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => handleDeleteLayer(layer.name)}
                    className="btn-danger btn-sm"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              {layer.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {layer.description}
                </p>
              )}
              
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <Package className="h-4 w-4 mr-1" />
                  <span>v{layer.version || '1.0.0'}</span>
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <Users className="h-4 w-4 mr-1" />
                  <span>{layer.functionsUsing?.length || 0} function(s)</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Version
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Functions
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedLayers.map((layer) => (
                <tr key={layer.name}>
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">
                    {layer.name}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`badge ${layer.status === 'loaded' ? 'badge-success' : 'badge-warning'}`}>
                      {layer.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    {layer.version || '1.0.0'}
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    {layer.functionsUsing?.length || 0}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      to={`/layers/${layer.name}`}
                      className="btn-secondary inline-flex items-center justify-center mr-2"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Link>
                    <button
                      onClick={() => handleDeleteLayer(layer.name)}
                      className="btn-danger inline-flex items-center justify-center"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center mt-6 space-x-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary"
          >
            Previous
          </button>
          <span className="text-gray-600 dark:text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-secondary"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

export default Layers

