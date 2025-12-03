import axios from 'axios'

export const api = axios.create({
  baseURL: '',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('funcdock-token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('funcdock-token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// API functions
export const functionsApi = {
  // Get all functions
  getFunctions: () => api.get('/api/functions'),
  
  // Get function details
  getFunction: (name) => api.get(`/api/functions/${name}`),
  
  // Deploy function from local files
  deployFromLocal: (name, files) => {
    const formData = new FormData()
    formData.append('name', name)
    files.forEach(file => {
      formData.append('files', file)
    })
    return api.post('/api/functions/deploy/local', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
  
  // Deploy function from git
  deployFromGit: (name, repo, branch, commit) => {
    return api.post('/api/functions/deploy/git', {
      name,
      repo,
      branch,
      commit
    })
  },
  
  // Update function
  updateFunction: (name, files) => {
    const formData = new FormData()
    formData.append('name', name)
    files.forEach(file => {
      formData.append('files', file)
    })
    return api.put(`/api/functions/${name}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
  
  // Delete function
  deleteFunction: (name) => api.delete(`/api/functions/${name}`),
  
  // Get function logs
  getLogs: (name, limit = 100) => api.get(`/api/functions/${name}/logs?limit=${limit}`),
  
  // Get function metrics
  getMetrics: (name) => api.get(`/api/functions/${name}/metrics`),
  
  // Test function
  testFunction: (name, method = 'GET', data = null) => {
    const config = {
      method,
      url: `/api/functions/${name}/test`,
    }
    if (data) {
      config.data = data
    }
    return api(config)
  },
  
  // Get cron jobs
  getCronJobs: (name) => api.get(`/api/functions/${name}/cron`),
  
  // Update cron jobs
  updateCronJobs: (name, cronJobs) => api.put(`/api/functions/${name}/cron`, { jobs: cronJobs }),
  
  // Get function files
  getFunctionFiles: (name) => api.get(`/api/functions/${name}/files`),
  
  // Get file content
  getFileContent: (name, filePath) => api.get(`/api/functions/${name}/files/content?path=${encodeURIComponent(filePath)}`),
  
  // Download file
  downloadFile: (name, filePath) => api.get(`/api/functions/${name}/files/download?path=${encodeURIComponent(filePath)}`, {
    responseType: 'blob'
  }),
  
  // Get function environment variables
  getEnv: (name) => api.get(`/api/functions/${name}/env`),
  
  // Set function layer
  setLayer: (name, layer) => api.put(`/api/functions/${name}/layer`, { layer }),
  
  // Remove function layer
  removeLayer: (name) => api.delete(`/api/functions/${name}/layer`),
}

export const authApi = {
  login: (username, password) => api.post('/api/auth/login', { username, password }),
  verify: () => api.get('/api/auth/verify'),
  logout: () => api.post('/api/auth/logout'),
}

export const systemApi = {
  getStatus: () => api.get('/api/status'),
  getMetrics: () => api.get('/api/metrics'),
  getLogs: (limit = 100) => api.get(`/api/logs?limit=${limit}`),
  getFunctionLogs: () => api.get('/api/logs/functions'),
}

// GitHub OAuth and Repos
export const githubApi = {
  getGithubOAuthUrl: () => api.get('/api/oauth/github'),
  getGithubRepos: () => api.get('/api/github/repos'),
}

// Bitbucket OAuth and Repos
export const bitbucketApi = {
  getBitbucketOAuthUrl: () => api.get('/api/oauth/bitbucket'),
  getBitbucketRepos: () => api.get('/api/bitbucket/repos'),
}

// Layers API
export const layersApi = {
  // Get all layers
  getLayers: () => api.get('/api/layers'),
  
  // Get layer details
  getLayer: (name) => api.get(`/api/layers/${name}`),
  
  // Get layer files
  getLayerFiles: (name) => api.get(`/api/layers/${name}/files`),
  
  // Get layer file content
  getLayerFileContent: (name, filePath) => api.get(`/api/layers/${name}/files/content?path=${encodeURIComponent(filePath)}`),
  
  // Download layer file
  downloadLayerFile: (name, filePath) => api.get(`/api/layers/${name}/files/download?path=${encodeURIComponent(filePath)}`, {
    responseType: 'blob'
  }),
  
  // Deploy layer from local files
  deployFromLocal: (name, files) => {
    const formData = new FormData()
    formData.append('name', name)
    files.forEach(file => {
      formData.append('files', file)
    })
    return api.post('/api/layers/deploy/local', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
  
  // Deploy layer from git
  deployFromGit: (name, repo, branch, commit) => {
    return api.post('/api/layers/deploy/git', {
      name,
      repo,
      branch,
      commit
    })
  },
  
  // Update layer
  updateLayer: (name, files) => {
    const formData = new FormData()
    files.forEach(file => {
      formData.append('files', file)
    })
    return api.put(`/api/layers/${name}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
  
  // Delete layer
  deleteLayer: (name) => api.delete(`/api/layers/${name}`),
  
  // Update layer file
  updateLayerFile: (name, filePath, content) => api.put(`/api/layers/${name}/files`, { path: filePath, content }),
  
  // Reload layer
  reloadLayer: (name) => api.post(`/api/layers/${name}/reload`),
  
  // Reload all layers
  reloadAllLayers: () => api.post('/api/layers/reload'),
} 