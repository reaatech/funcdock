import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { functionsApi, layersApi, githubApi, bitbucketApi } from '../utils/api';
import { Upload, GitBranch, File, Folder, X, Package } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const Deploy = () => {
  const [deployType, setDeployType] = useState('function'); // 'function' or 'layer'
  const [deployMethod, setDeployMethod] = useState('local');
  const [functionName, setFunctionName] = useState('');
  const [layerName, setLayerName] = useState('');
  const [files, setFiles] = useState([]);
  const [gitRepo, setGitRepo] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [gitCommit, setGitCommit] = useState('');
  const [loading, setLoading] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);
  const [bitbucketConnected, setBitbucketConnected] = useState(false);
  const [githubRepos, setGithubRepos] = useState([]);
  const [bitbucketRepos, setBitbucketRepos] = useState([]);
  const [selectedGithubRepo, setSelectedGithubRepo] = useState('');
  const [selectedBitbucketRepo, setSelectedBitbucketRepo] = useState('');
  const navigate = useNavigate();

  const handleFileSelect = (event) => {
    const selectedFiles = Array.from(event.target.files);
    setFiles(selectedFiles);
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleDeploy = async (e) => {
    e.preventDefault();

    const name = deployType === 'function' ? functionName : layerName;

    if (!name.trim()) {
      toast.error(`${deployType === 'function' ? 'Function' : 'Layer'} name is required`);
      return;
    }

    if (deployMethod === 'local' && files.length === 0) {
      toast.error('Please select at least one file');
      return;
    }

    if (deployMethod === 'git' && !gitRepo.trim()) {
      toast.error('Git repository URL is required');
      return;
    }

    if (deployMethod === 'github' && !selectedGithubRepo) {
      toast.error('Please select a GitHub repository');
      return;
    }

    if (deployMethod === 'bitbucket' && !selectedBitbucketRepo) {
      toast.error('Please select a Bitbucket repository');
      return;
    }

    setLoading(true);

    try {
      if (deployType === 'function') {
        // Deploy function
        if (deployMethod === 'local') {
          await functionsApi.deployFromLocal(name, files);
          toast.success('Function deployed successfully!');
        } else if (deployMethod === 'git') {
          await functionsApi.deployFromGit(name, gitRepo, gitBranch, gitCommit);
          toast.success('Function deployed from Git successfully!');
        } else if (deployMethod === 'github') {
          const repoUrl = `https://github.com/${selectedGithubRepo}.git`;
          await functionsApi.deployFromGit(name, repoUrl, 'main', '');
          toast.success('Function deployed from GitHub successfully!');
        } else if (deployMethod === 'bitbucket') {
          const repoUrl = `https://bitbucket.org/${selectedBitbucketRepo}.git`;
          await functionsApi.deployFromGit(name, repoUrl, 'main', '');
          toast.success('Function deployed from Bitbucket successfully!');
        }
        navigate('/functions');
      } else {
        // Deploy layer
        if (deployMethod === 'local') {
          await layersApi.deployFromLocal(name, files);
          toast.success('Layer deployed successfully!');
        } else if (deployMethod === 'git') {
          await layersApi.deployFromGit(name, gitRepo, gitBranch, gitCommit);
          toast.success('Layer deployed from Git successfully!');
        } else if (deployMethod === 'github') {
          const repoUrl = `https://github.com/${selectedGithubRepo}.git`;
          await layersApi.deployFromGit(name, repoUrl, 'main', '');
          toast.success('Layer deployed from GitHub successfully!');
        } else if (deployMethod === 'bitbucket') {
          const repoUrl = `https://bitbucket.org/${selectedBitbucketRepo}.git`;
          await layersApi.deployFromGit(name, repoUrl, 'main', '');
          toast.success('Layer deployed from Bitbucket successfully!');
        }
        navigate('/layers');
      }
    } catch (error) {
      console.error('Deployment failed:', error);
      toast.error(error.response?.data?.message || 'Deployment failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (window.location.search.includes('github=success')) {
      setGithubConnected(true);
      githubApi.getGithubRepos().then(({ data }) => {
        setGithubRepos(data);
      });
    }
    if (window.location.search.includes('bitbucket=success')) {
      setBitbucketConnected(true);
      bitbucketApi.getBitbucketRepos().then(({ data }) => {
        setBitbucketRepos(data);
      });
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Deploy</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Deploy a new function or layer to FuncDock
        </p>
      </div>

      {/* Type Selector */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => {
              setDeployType('function');
              setFunctionName('');
              setLayerName('');
              setFiles([]);
            }}
            className={`inline-flex items-center justify-center py-2 px-1 border-b-2 font-medium text-sm ${
              deployType === 'function'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <File className="h-4 w-4 mr-2" />
            Function
          </button>
          <button
            onClick={() => {
              setDeployType('layer');
              setFunctionName('');
              setLayerName('');
              setFiles([]);
            }}
            className={`inline-flex items-center justify-center py-2 px-1 border-b-2 font-medium text-sm ${
              deployType === 'layer'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <Package className="h-4 w-4 mr-2" />
            Layer
          </button>
        </nav>
      </div>

      {/* Deployment Method Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setDeployMethod('local')}
            className={`inline-flex items-center justify-center py-2 px-1 border-b-2 font-medium text-sm ${
              deployMethod === 'local'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Files
          </button>
          <button
            onClick={() => setDeployMethod('git')}
            className={`inline-flex items-center justify-center py-2 px-1 border-b-2 font-medium text-sm ${
              deployMethod === 'git'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <GitBranch className="h-4 w-4 mr-2" />
            Git Repository
          </button>
          <button
            onClick={() => setDeployMethod('github')}
            className={`inline-flex items-center justify-center py-2 px-1 border-b-2 font-medium text-sm ${
              deployMethod === 'github'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <GitBranch className="h-4 w-4 mr-2" />
            GitHub
          </button>
          <button
            onClick={() => setDeployMethod('bitbucket')}
            className={`inline-flex items-center justify-center py-2 px-1 border-b-2 font-medium text-sm ${
              deployMethod === 'bitbucket'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <GitBranch className="h-4 w-4 mr-2" />
            Bitbucket
          </button>
        </nav>
      </div>

      {/* Deployment Form */}
      <form onSubmit={handleDeploy} className="space-y-6">
        {/* Name Input */}
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {deployType === 'function' ? 'Function' : 'Layer'} Name
          </label>
          {deployType === 'function' ? (
            <input
              type="text"
              id="name"
              value={functionName}
              onChange={(e) => setFunctionName(e.target.value)}
              className="input mt-1"
              placeholder="my-function"
              required
            />
          ) : (
            <input
              type="text"
              id="name"
              value={layerName}
              onChange={(e) => setLayerName(e.target.value)}
              className="input mt-1"
              placeholder="my-layer"
              required
            />
          )}
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {deployType === 'function'
              ? 'This will be the URL path for your function (e.g., /my-function)'
              : 'The name of your layer (e.g., my-layer)'}
          </p>
        </div>

        {/* Local File Upload */}
        {deployMethod === 'local' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {deployType === 'function' ? 'Function' : 'Layer'} Files
            </label>
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
              <div className="text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                  <label
                    htmlFor="file-upload"
                    className="btn-primary cursor-pointer inline-flex items-center justify-center whitespace-nowrap"
                  >
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
                  {deployType === 'function'
                    ? 'Upload handler.js, route.config.json, package.json, and other function files'
                    : 'Upload layer files (will be placed in nodejs/ directory)'}
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
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded"
                    >
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
              <label
                htmlFor="gitRepo"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
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
                <label
                  htmlFor="gitBranch"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
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
                <label
                  htmlFor="gitCommit"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
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

        {/* GitHub Deployment */}
        {deployMethod === 'github' && (
          <div className="space-y-4">
            {!githubConnected ? (
              <button
                type="button"
                className="btn-primary"
                onClick={async () => {
                  try {
                    const { data } = await githubApi.getGithubOAuthUrl();
                    window.location.href = data.url;
                  } catch (err) {
                    toast.error('Failed to start GitHub OAuth');
                  }
                }}
              >
                Connect to GitHub
              </button>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select a GitHub Repository
                </label>
                <select
                  className="input mt-1"
                  value={selectedGithubRepo}
                  onChange={(e) => setSelectedGithubRepo(e.target.value)}
                >
                  <option value="">-- Select a repository --</option>
                  {githubRepos.map((repo) => (
                    <option key={repo.id} value={repo.full_name}>
                      {repo.full_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Bitbucket Deployment */}
        {deployMethod === 'bitbucket' && (
          <div className="space-y-4">
            {!bitbucketConnected ? (
              <button
                type="button"
                className="btn-primary"
                onClick={async () => {
                  try {
                    const { data } = await bitbucketApi.getBitbucketOAuthUrl();
                    window.location.href = data.url;
                  } catch (err) {
                    toast.error('Failed to start Bitbucket OAuth');
                  }
                }}
              >
                Connect to Bitbucket
              </button>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select a Bitbucket Repository
                </label>
                <select
                  className="input mt-1"
                  value={selectedBitbucketRepo}
                  onChange={(e) => setSelectedBitbucketRepo(e.target.value)}
                >
                  <option value="">-- Select a repository --</option>
                  {bitbucketRepos.map((repo) => (
                    <option key={repo.uuid} value={repo.full_name}>
                      {repo.full_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Deploy Button */}
        <div className="flex justify-end space-x-3">
          <button type="button" onClick={() => navigate('/functions')} className="btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary inline-flex items-center justify-center"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Deploying...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Deploy {deployType === 'function' ? 'Function' : 'Layer'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Deploy;
