import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { layersApi } from '../utils/api';
import {
  Layers as LayersIcon,
  Trash2,
  ArrowLeft,
  Package,
  Users,
  FileText,
  Folder,
  File,
  ChevronRight,
  ChevronDown,
  Eye as EyeIcon,
  Download as DownloadIcon,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Edit,
  X,
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const LayerDetail = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const [layerData, setLayerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [layerFiles, setLayerFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [editingFile, setEditingFile] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState(new Set());

  const { on, off } = useSocket();

  useEffect(() => {
    fetchLayerData();

    const handleLayerUpdated = (data) => {
      if (data.name === name) {
        fetchLayerData();
      }
    };

    const handleLayerDeleted = (data) => {
      if (data.name === name) {
        navigate('/layers');
      }
    };

    // Listen for real-time updates
    on('layer:updated', handleLayerUpdated);
    on('layer:deleted', handleLayerDeleted);

    return () => {
      off('layer:updated', handleLayerUpdated);
      off('layer:deleted', handleLayerDeleted);
    };
  }, [name, on, off, navigate]);

  const fetchLayerData = async () => {
    try {
      const [layerRes, filesRes] = await Promise.all([
        layersApi.getLayer(name),
        layersApi.getLayerFiles(name),
      ]);

      setLayerData(layerRes.data);
      setLayerFiles(filesRes.data.files || []);
    } catch (error) {
      console.error('Failed to fetch layer data:', error);
      toast.error('Failed to load layer data');
      if (error.response?.status === 404) {
        navigate('/layers');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLayer = async () => {
    if (
      !confirm(`Are you sure you want to delete the layer "${name}"? This action cannot be undone.`)
    ) {
      return;
    }

    try {
      await layersApi.deleteLayer(name);
      toast.success(`Layer "${name}" deleted successfully`);
      navigate('/layers');
    } catch (error) {
      console.error('Failed to delete layer:', error);
      const errorMsg = error.response?.data?.message || 'Failed to delete layer';
      toast.error(errorMsg);
    }
  };

  const handleFileClick = async (filePath, isDirectory) => {
    if (isDirectory) {
      const newExpanded = new Set(expandedFolders);
      if (newExpanded.has(filePath)) {
        newExpanded.delete(filePath);
      } else {
        newExpanded.add(filePath);
      }
      setExpandedFolders(newExpanded);
      return;
    }

    setSelectedFile(filePath);
    setFileLoading(true);
    try {
      const response = await layersApi.getLayerFileContent(name, filePath);
      setFileContent(response.data.content);
      setEditedContent(response.data.content);
      setEditingFile(false);
    } catch (error) {
      console.error('Failed to load file content:', error);
      toast.error('Failed to load file content');
      setFileContent('');
    } finally {
      setFileLoading(false);
    }
  };

  const handleDownloadFile = async (filePath) => {
    try {
      const response = await layersApi.downloadLayerFile(name, filePath);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filePath.split('/').pop());
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('File downloaded successfully');
    } catch (error) {
      console.error('Failed to download file:', error);
      toast.error('Failed to download file');
    }
  };

  const renderFileTree = (files, level = 0) => {
    return files.map((item) => {
      const isExpanded = expandedFolders.has(item.path);
      const isSelected = selectedFile === item.path;

      if (item.type === 'directory') {
        return (
          <div key={item.path}>
            <div
              onClick={() => handleFileClick(item.path, true)}
              className={`flex items-center py-2 px-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                isSelected ? 'bg-gray-100 dark:bg-gray-800' : ''
              }`}
              style={{ paddingLeft: `${level * 20 + 16}px` }}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 mr-2 text-gray-500" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-2 text-gray-500" />
              )}
              <Folder className="h-4 w-4 mr-2 text-blue-500" />
              <span className="text-sm text-gray-900 dark:text-white">{item.name}</span>
            </div>
            {isExpanded && item.children && item.children.length > 0 && (
              <div>{renderFileTree(item.children, level + 1)}</div>
            )}
          </div>
        );
      }

      return (
        <div
          key={item.path}
          onClick={() => handleFileClick(item.path, false)}
          className={`flex items-center justify-between py-2 px-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
            isSelected ? 'bg-gray-100 dark:bg-gray-800' : ''
          }`}
          style={{ paddingLeft: `${level * 20 + 16}px` }}
        >
          <div className="flex items-center flex-1">
            <File className="h-4 w-4 mr-2 text-gray-500" />
            <span className="text-sm text-gray-900 dark:text-white">{item.name}</span>
            <span className="text-xs text-gray-500 ml-2">({(item.size / 1024).toFixed(2)} KB)</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownloadFile(item.path);
            }}
            className="btn-secondary btn-sm ml-2"
          >
            <DownloadIcon className="h-4 w-4" />
          </button>
        </div>
      );
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'loaded':
        return <CheckCircle className="h-5 w-5 text-success-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-danger-600" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-warning-600" />;
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!layerData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Layer not found</h2>
          <Link to="/layers" className="btn-primary">
            Back to Layers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link to="/layers" className="btn-secondary inline-flex items-center mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Layers
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {getStatusIcon(layerData.status)}
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white ml-3">
              {layerData.name}
            </h1>
          </div>
          <button
            onClick={handleDeleteLayer}
            className="btn-danger inline-flex items-center"
            disabled={layerData.functionsUsing && layerData.functionsUsing.length > 0}
          >
            <Trash2 className="h-5 w-5 mr-2" />
            Delete Layer
          </button>
        </div>

        {layerData.description && (
          <p className="text-gray-600 dark:text-gray-400 mt-2">{layerData.description}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'files'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Files
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Layer Info */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Layer Information
            </h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">{layerData.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Version</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {layerData.version || '1.0.0'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                <dd className="mt-1">
                  <span
                    className={`badge ${layerData.status === 'loaded' ? 'badge-success' : 'badge-warning'}`}
                  >
                    {layerData.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Loaded At</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {new Date(layerData.loadedAt).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>

          {/* Functions Using This Layer */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Functions Using This Layer
            </h2>
            {layerData.functionsUsing && layerData.functionsUsing.length > 0 ? (
              <ul className="space-y-2">
                {layerData.functionsUsing.map((funcName) => (
                  <li key={funcName}>
                    <Link
                      to={`/functions/${funcName}`}
                      className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                    >
                      {funcName}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No functions are using this layer</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'files' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* File Tree */}
          <div className="lg:col-span-1 card">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Files</h2>
            <div className="max-h-96 overflow-y-auto">
              {layerFiles.length > 0 ? (
                renderFileTree(layerFiles)
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No files found</p>
              )}
            </div>
          </div>

          {/* File Content */}
          <div className="lg:col-span-2 card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {selectedFile ? `File: ${selectedFile.split('/').pop()}` : 'Select a file to view'}
              </h2>
              {selectedFile && fileContent && !editingFile && (
                <button
                  onClick={() => {
                    setEditingFile(true);
                    setEditedContent(fileContent);
                  }}
                  className="btn-primary btn-sm inline-flex items-center"
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </button>
              )}
            </div>
            {fileLoading ? (
              <LoadingSpinner />
            ) : selectedFile && fileContent ? (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                {editingFile && (
                  <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-end space-x-2">
                    <button
                      onClick={async () => {
                        setSaving(true);
                        try {
                          await layersApi.updateLayerFile(name, selectedFile, editedContent);
                          toast.success('File updated successfully');
                          setFileContent(editedContent);
                          setEditingFile(false);
                          fetchLayerData();
                        } catch (error) {
                          console.error('Failed to update file:', error);
                          toast.error(error.response?.data?.message || 'Failed to update file');
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving}
                      className="btn-primary btn-sm inline-flex items-center"
                    >
                      {saving ? (
                        <>
                          <LoadingSpinner size="sm" className="mr-1" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Save
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setEditingFile(false);
                        setEditedContent(fileContent);
                      }}
                      disabled={saving}
                      className="btn-secondary btn-sm inline-flex items-center"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </button>
                  </div>
                )}
                <div className="p-4">
                  {editingFile ? (
                    <textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="w-full h-96 p-4 font-mono text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded"
                      style={{ resize: 'none' }}
                    />
                  ) : (
                    <pre className="overflow-x-auto text-sm">
                      <code>{fileContent}</code>
                    </pre>
                  )}
                </div>
              </div>
            ) : selectedFile ? (
              <p className="text-gray-500 dark:text-gray-400">Failed to load file content</p>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">
                Select a file from the list to view its contents
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LayerDetail;
