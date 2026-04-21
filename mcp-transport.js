import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import Logger from './utils/logger.js';

const logger = new Logger({
  logLevel: process.env.LOG_LEVEL || 'info',
  logToFile: true,
  logToConsole: true,
  functionName: 'mcp-transport',
});

class FuncDockMCPTransport {
  constructor(options = {}) {
    this.mcpServerUrl =
      options.mcpServerUrl || process.env.MCP_SERVER_URL || 'http://localhost:3001';
    this.client = null;
    this.connected = false;
  }

  async connectHTTP() {
    this.client = new Client({
      name: 'funcdock-mcp-transport',
      version: '2.0.0',
    });

    const transport = new SSEClientTransport(new URL(this.mcpServerUrl));
    await this.client.connect(transport);
    this.connected = true;
    logger.info(`Connected to MCP server at ${this.mcpServerUrl}`);
    return this;
  }

  async connectStdio(command, args = [], env = {}) {
    this.client = new Client({
      name: 'funcdock-mcp-transport',
      version: '2.0.0',
    });

    const transport = new StdioClientTransport({
      command,
      args,
      env,
    });

    await this.client.connect(transport);
    this.connected = true;
    logger.info(`Connected to MCP server via stdio: ${command} ${args.join(' ')}`);
    return this;
  }

  async invokeFunction(functionName, options = {}) {
    if (!this.connected || !this.client) {
      throw new Error('MCP transport not connected');
    }

    const routePath = options.routePath || '/';
    const method = options.method || 'POST';
    const toolName = `${functionName}__${routePath.replace(/[/:]/g, '_').replace(/^_/, '')}__${method.toLowerCase()}`;

    const result = await this.client.callTool({
      name: toolName,
      arguments: {
        functionName,
        routePath,
        method,
        body: options.body || {},
        query: options.query || {},
        params: options.params || {},
      },
    });

    return result;
  }

  async listTools() {
    if (!this.connected || !this.client) {
      throw new Error('MCP transport not connected');
    }

    const { tools } = await this.client.listTools();
    return tools;
  }

  async disconnect() {
    if (this.client) {
      this.client.close();
      this.connected = false;
      logger.info('Disconnected from MCP server');
    }
  }
}

export default FuncDockMCPTransport;
