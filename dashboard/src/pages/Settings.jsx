import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { systemApi } from '../utils/api'
import { 
  Settings as SettingsIcon, 
  Shield, 
  Database, 
  Server, 
  User,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Key,
  Globe,
  Clock,
  Activity
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'

const Settings = () => {
  const { user, logout } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [systemMetrics, setSystemMetrics] = useState(null)
  const [activeTab, setActiveTab] = useState('general')
  const [showPassword, setShowPassword] = useState(false)
  
  // Settings state
  const [settings, setSettings] = useState({
    general: {
      platformName: 'FuncDock',
      maxFunctions: 100,
      maxFileSize: 10,
      enableHotReload: true,
      enableCors: true
    },
    security: {
      enableRateLimit: true,
      rateLimitWindow: 15,
      rateLimitMax: 100,
      enableJwtAuth: true,
      jwtExpiry: 24,
      requireHttps: false
    },
    logging: {
      logLevel: 'INFO',
      maxLogSize: 100,
      enableFileLogging: true,
      enableConsoleLogging: true,
      logRetention: 30
    },
    performance: {
      enableCompression: true,
      enableCaching: true,
      cacheTtl: 300,
      maxConcurrentRequests: 50,
      requestTimeout: 30
    }
  })

  useEffect(() => {
    fetchSystemMetrics()
    loadSettings()
  }, [])

  const fetchSystemMetrics = async () => {
    try {
      const response = await systemApi.getMetrics()
      setSystemMetrics(response.data)
    } catch (error) {
      console.error('Failed to fetch system metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSettings = () => {
    // In a real app, you'd load settings from localStorage or API
    const savedSettings = localStorage.getItem('funcdock-settings')
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings))
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      // In a real app, you'd save settings to API
      localStorage.setItem('funcdock-settings', JSON.stringify(settings))
      toast.success('Settings saved successfully')
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleSettingChange = (section, key, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }))
  }

  const handleLogout = () => {
    logout()
  }

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            System configuration and preferences
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={fetchSystemMetrics}
            className="btn-secondary"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </button>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? (
              <>
                <LoadingSpinner size="sm" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-1" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="p-4">
              <nav className="space-y-1">
                {[
                  { id: 'general', label: 'General', icon: SettingsIcon },
                  { id: 'security', label: 'Security', icon: Shield },
                  { id: 'logging', label: 'Logging', icon: Database },
                  { id: 'performance', label: 'Performance', icon: Activity },
                  { id: 'system', label: 'System Info', icon: Server }
                ].map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        activeTab === tab.id
                          ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-800'
                      }`}
                    >
                      <Icon className="h-4 w-4 mr-3" />
                      {tab.label}
                    </button>
                  )
                })}
              </nav>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <div className="card">
            <div className="p-6">
              {/* General Settings */}
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">General Settings</h3>
                  
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Platform Name
                      </label>
                      <input
                        type="text"
                        value={settings.general.platformName}
                        onChange={(e) => handleSettingChange('general', 'platformName', e.target.value)}
                        className="input mt-1"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Max Functions
                      </label>
                      <input
                        type="number"
                        value={settings.general.maxFunctions}
                        onChange={(e) => handleSettingChange('general', 'maxFunctions', parseInt(e.target.value))}
                        className="input mt-1"
                        min="1"
                        max="1000"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Max File Size (MB)
                      </label>
                      <input
                        type="number"
                        value={settings.general.maxFileSize}
                        onChange={(e) => handleSettingChange('general', 'maxFileSize', parseInt(e.target.value))}
                        className="input mt-1"
                        min="1"
                        max="100"
                      />
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="hotReload"
                        checked={settings.general.enableHotReload}
                        onChange={(e) => handleSettingChange('general', 'enableHotReload', e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor="hotReload" className="ml-2 block text-sm text-gray-900 dark:text-white">
                        Enable Hot Reload
                      </label>
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="cors"
                        checked={settings.general.enableCors}
                        onChange={(e) => handleSettingChange('general', 'enableCors', e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor="cors" className="ml-2 block text-sm text-gray-900 dark:text-white">
                        Enable CORS
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Security Settings */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Security Settings</h3>
                  
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="rateLimit"
                        checked={settings.security.enableRateLimit}
                        onChange={(e) => handleSettingChange('security', 'enableRateLimit', e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor="rateLimit" className="ml-2 block text-sm text-gray-900 dark:text-white">
                        Enable Rate Limiting
                      </label>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Rate Limit Window (minutes)
                      </label>
                      <input
                        type="number"
                        value={settings.security.rateLimitWindow}
                        onChange={(e) => handleSettingChange('security', 'rateLimitWindow', parseInt(e.target.value))}
                        className="input mt-1"
                        min="1"
                        max="60"
                        disabled={!settings.security.enableRateLimit}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Rate Limit Max Requests
                      </label>
                      <input
                        type="number"
                        value={settings.security.rateLimitMax}
                        onChange={(e) => handleSettingChange('security', 'rateLimitMax', parseInt(e.target.value))}
                        className="input mt-1"
                        min="1"
                        max="1000"
                        disabled={!settings.security.enableRateLimit}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        JWT Expiry (hours)
                      </label>
                      <input
                        type="number"
                        value={settings.security.jwtExpiry}
                        onChange={(e) => handleSettingChange('security', 'jwtExpiry', parseInt(e.target.value))}
                        className="input mt-1"
                        min="1"
                        max="168"
                      />
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="https"
                        checked={settings.security.requireHttps}
                        onChange={(e) => handleSettingChange('security', 'requireHttps', e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor="https" className="ml-2 block text-sm text-gray-900 dark:text-white">
                        Require HTTPS
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Logging Settings */}
              {activeTab === 'logging' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Logging Settings</h3>
                  
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Log Level
                      </label>
                      <select
                        value={settings.logging.logLevel}
                        onChange={(e) => handleSettingChange('logging', 'logLevel', e.target.value)}
                        className="input mt-1"
                      >
                        <option value="DEBUG">Debug</option>
                        <option value="INFO">Info</option>
                        <option value="WARN">Warning</option>
                        <option value="ERROR">Error</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Max Log Size (MB)
                      </label>
                      <input
                        type="number"
                        value={settings.logging.maxLogSize}
                        onChange={(e) => handleSettingChange('logging', 'maxLogSize', parseInt(e.target.value))}
                        className="input mt-1"
                        min="1"
                        max="1000"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Log Retention (days)
                      </label>
                      <input
                        type="number"
                        value={settings.logging.logRetention}
                        onChange={(e) => handleSettingChange('logging', 'logRetention', parseInt(e.target.value))}
                        className="input mt-1"
                        min="1"
                        max="365"
                      />
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="fileLogging"
                        checked={settings.logging.enableFileLogging}
                        onChange={(e) => handleSettingChange('logging', 'enableFileLogging', e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor="fileLogging" className="ml-2 block text-sm text-gray-900 dark:text-white">
                        Enable File Logging
                      </label>
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="consoleLogging"
                        checked={settings.logging.enableConsoleLogging}
                        onChange={(e) => handleSettingChange('logging', 'enableConsoleLogging', e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor="consoleLogging" className="ml-2 block text-sm text-gray-900 dark:text-white">
                        Enable Console Logging
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Performance Settings */}
              {activeTab === 'performance' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Performance Settings</h3>
                  
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="compression"
                        checked={settings.performance.enableCompression}
                        onChange={(e) => handleSettingChange('performance', 'enableCompression', e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor="compression" className="ml-2 block text-sm text-gray-900 dark:text-white">
                        Enable Compression
                      </label>
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="caching"
                        checked={settings.performance.enableCaching}
                        onChange={(e) => handleSettingChange('performance', 'enableCaching', e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor="caching" className="ml-2 block text-sm text-gray-900 dark:text-white">
                        Enable Caching
                      </label>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Cache TTL (seconds)
                      </label>
                      <input
                        type="number"
                        value={settings.performance.cacheTtl}
                        onChange={(e) => handleSettingChange('performance', 'cacheTtl', parseInt(e.target.value))}
                        className="input mt-1"
                        min="1"
                        max="3600"
                        disabled={!settings.performance.enableCaching}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Max Concurrent Requests
                      </label>
                      <input
                        type="number"
                        value={settings.performance.maxConcurrentRequests}
                        onChange={(e) => handleSettingChange('performance', 'maxConcurrentRequests', parseInt(e.target.value))}
                        className="input mt-1"
                        min="1"
                        max="200"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Request Timeout (seconds)
                      </label>
                      <input
                        type="number"
                        value={settings.performance.requestTimeout}
                        onChange={(e) => handleSettingChange('performance', 'requestTimeout', parseInt(e.target.value))}
                        className="input mt-1"
                        min="1"
                        max="300"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* System Info */}
              {activeTab === 'system' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">System Information</h3>
                  
                  {systemMetrics && (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                        <div className="flex items-center">
                          <Server className="h-6 w-6 text-blue-600" />
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Uptime</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                              {formatUptime(systemMetrics.uptime)}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                        <div className="flex items-center">
                          <Database className="h-6 w-6 text-green-600" />
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Functions</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                              {systemMetrics.functions}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                        <div className="flex items-center">
                          <Activity className="h-6 w-6 text-purple-600" />
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Routes</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                              {systemMetrics.activeRoutes}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                        <div className="flex items-center">
                          <Clock className="h-6 w-6 text-orange-600" />
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Cron Jobs</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                              {systemMetrics.activeCronJobs}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                        <div className="flex items-center">
                          <Key className="h-6 w-6 text-red-600" />
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Memory Usage</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                              {formatBytes(systemMetrics.memory?.heapUsed || 0)}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                        <div className="flex items-center">
                          <Globe className="h-6 w-6 text-indigo-600" />
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Platform</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                              FuncDock
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">User Information</h4>
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                        <div>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Username</dt>
                          <dd className="text-sm text-gray-900 dark:text-white">{user?.username || 'admin'}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Role</dt>
                          <dd className="text-sm text-gray-900 dark:text-white">Administrator</dd>
                        </div>
                      </dl>
                      <div className="mt-4">
                        <button
                          onClick={handleLogout}
                          className="btn-danger text-sm"
                        >
                          Logout
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings 