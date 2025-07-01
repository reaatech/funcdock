import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { functionsApi } from '../utils/api'
import { Upload, GitBranch, File, Folder, X } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'

const Deploy = () => {
  const [deployMethod, setDeployMethod] = useState('local')
  const [functionName, setFunctionName] = useState('')
  const [files, setFiles] = useState([])
  const [gitRepo, setGitRepo] = useState('')
  const [gitBranch, setGitBranch] = useState('main')
  const [gitCommit, setGitCommit] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleFileSelect = (event) => {
    const selectedFiles = Array.from(event.target.files)
    setFiles(selectedFiles)
  }

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  const handleDeploy = async (e) => {
    e.preventDefault()
    
    if (!functionName.trim()) {
      toast.error('Function name is required')
      return
    }

    if (deployMethod === 'local' && files.length === 0) {
      toast.error('Please select at least one file')
      return
    }

    if (deployMethod === 'git' && !gitRepo.trim()) {
      toast.error('Git repository URL is required')
      return
    }

    setLoading(true)

    try {
      if (deployMethod === 'local') {
        await functionsApi.deployFromLocal(functionName, files)
        toast.success('Function deployed successfully!')
      } else {
        await functionsApi.deployFromGit(functionName, gitRepo, gitBranch, gitCommit)
        toast.success('Function deployed from Git successfully!')
      }
      
      navigate('/functions')
    } catch (error) {
      console.error('Deployment failed:', error)
      toast.error(error.response?.data?.message || 'Deployment failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Deploy Function</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Deploy a new function to FuncDock
        </p>
      </div>

      {/* Deployment Method Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setDeployMethod('local')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              deployMethod === 'local'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <Upload className="h-4 w-4 inline mr-2" />
            Upload Files
          </button>
          <button
            onClick={() => setDeployMethod('git')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              deployMethod === 'git'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <GitBranch className="h-4 w-4 inline mr-2" />
            Git Repository
          </button>
        </nav>
      </div>

      {/* Deployment Form */}
      <form onSubmit={handleDeploy} className="space-y-6">
        {/* Function Name */}
        <div>
          <label htmlFor="functionName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Function Name
          </label>
          <input
            type="text"
            id="functionName"
            value={functionName}
            onChange={(e) => setFunctionName(e.target.value)}
            className="input mt-1"
            placeholder="my-function"
            required
          />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            This will be the URL path for your function (e.g., /my-function)
          </p>
        </div>

        {/* Local File Upload */}
        {deployMethod === 'local' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Function Files
            </label>
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
              <div className="text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                  <label htmlFor="file-upload" className="btn-primary cursor-pointer">
                    <File className="h-4 w-4 mr-2" />
                    Select Files
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".js,.json,.txt,.md,.yml,.yaml"
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Upload handler.js, route.config.json, package.json, and other function files
                </p>
              </div>
            </div>

            {/* Selected Files */}
            {files.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Selected Files ({files.length})
                </h4>
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <div className="flex items-center">
                        <File className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900 dark:text-white">{file.name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Git Repository */}
        {deployMethod === 'git' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="gitRepo" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Repository URL
              </label>
              <input
                type="url"
                id="gitRepo"
                value={gitRepo}
                onChange={(e) => setGitRepo(e.target.value)}
                className="input mt-1"
                placeholder="https://github.com/username/repo.git"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="gitBranch" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Branch
                </label>
                <input
                  type="text"
                  id="gitBranch"
                  value={gitBranch}
                  onChange={(e) => setGitBranch(e.target.value)}
                  className="input mt-1"
                  placeholder="main"
                />
              </div>

              <div>
                <label htmlFor="gitCommit" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Commit (optional)
                </label>
                <input
                  type="text"
                  id="gitCommit"
                  value={gitCommit}
                  onChange={(e) => setGitCommit(e.target.value)}
                  className="input mt-1"
                  placeholder="abc123..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Deploy Button */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/functions')}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Deploying...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Deploy Function
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default Deploy 