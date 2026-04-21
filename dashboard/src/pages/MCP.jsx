import React, { useState, useEffect } from 'react';
import { api, functionsApi } from '../utils/api';
import {
  Plug,
  Server,
  Activity,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  Copy,
  Code,
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

function MCP() {
  const [loading, setLoading] = useState(true);
  const [tools, setTools] = useState([]);
  const [mcpStatus, setMcpStatus] = useState(null);

  const fetchMCPStatus = async () => {
    try {
      const [statusRes, functionsRes] = await Promise.all([
        api.get('/api/status'),
        api.get('/api/functions'),
      ]);

      const mcpPort = import.meta.env.VITE_MCP_HTTP_PORT || 3001;
      setMcpStatus({
        enabled: true,
        port: mcpPort,
        url: `http://localhost:${mcpPort}`,
      });

      const functions = functionsRes.data.functions || [];
      const toolList = [];

      functions.forEach((func) => {
        if (func.routes && func.routes.length > 0) {
          func.routes.forEach((route) => {
            const methods = route.methods || ['GET', 'POST'];
            methods.forEach((method) => {
              const toolName = `${func.name}__${route.path.replace(/[/:]/g, '_').replace(/^_/, '')}__${method.toLowerCase()}`;
              toolList.push({
                name: toolName,
                functionName: func.name,
                route: route.path,
                method,
                status: func.status || 'running',
              });
            });
          });
        }
      });

      setTools(toolList);
    } catch (error) {
      console.error('Failed to fetch MCP status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMCPStatus();
  }, []);

  const copyToolName = (name) => {
    navigator.clipboard.writeText(name);
    toast.success('Tool name copied to clipboard');
  };

  if (loading) {
    return <LoadingSpinner size="xl" text="Loading MCP tools..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Plug className="h-7 w-7" />
            MCP Server
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Functions exposed as MCP tools for AI agent integration
          </p>
        </div>
        <button
          onClick={fetchMCPStatus}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {mcpStatus && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Server className="h-4 w-4" />
              Status
            </div>
            <div className="mt-2 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="font-semibold text-gray-900 dark:text-white">Running</span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Activity className="h-4 w-4" />
              Endpoint
            </div>
            <div className="mt-2 font-mono text-sm text-gray-900 dark:text-white">
              {mcpStatus.url}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Code className="h-4 w-4" />
              Total Tools
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {tools.length}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">Available MCP Tools</h2>
        </div>

        {tools.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <Plug className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <p>No MCP tools available. Deploy functions to expose them as MCP tools.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                    Tool Name
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                    Function
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                    Route
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                    Method
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {tools.map((tool, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                    <td className="px-4 py-3">
                      <code className="font-mono text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
                        {tool.name}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white">{tool.functionName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                      {tool.route}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          tool.method === 'GET'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : tool.method === 'POST'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : tool.method === 'PUT'
                                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {tool.method}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {tool.status === 'running' ? (
                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <CheckCircle className="h-4 w-4" />
                          Running
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                          <XCircle className="h-4 w-4" />
                          {tool.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => copyToolName(tool.name)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Copy tool name"
                      >
                        <Copy className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Connecting MCP Clients</h3>
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <p>Connect Claude Desktop, IDE agents, or other MCP clients to this server at:</p>
          <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded-lg font-mono text-xs overflow-x-auto">
            {mcpStatus?.url || 'http://localhost:3001'}
          </pre>
          <p className="text-xs text-gray-500">
            Each deployed function route is automatically exposed as an MCP tool. Tool names follow
            the pattern:{' '}
            <code className="bg-gray-100 dark:bg-gray-900 px-1 rounded">
              {'{function}__{route}__{method}'}
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}

export default MCP;
