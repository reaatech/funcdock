import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import crypto from 'crypto';
import { createServer } from 'http';
import Logger from './utils/logger.js';

const logger = new Logger({
  logLevel: process.env.LOG_LEVEL || 'info',
  logToFile: true,
  logToConsole: true,
  functionName: 'mcp-server',
});

const MCP_API_KEY = process.env.MCP_API_KEY || '';
// Bind to loopback by default; explicit opt-in required to expose externally.
const MCP_HTTP_HOST = process.env.MCP_HTTP_HOST || '127.0.0.1';
const VALID_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

class FuncDockMCPServer {
  constructor(options = {}) {
    this.loadedFunctions = options.loadedFunctions || new Map();
    this.registeredRoutes = options.registeredRoutes || new Map();
    this.invokeFunction = options.invokeFunction || null;
    this.httpServer = null;
    this.server = new Server(
      {
        name: 'funcdock-mcp',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  buildToolSchema(funcInfo) {
    const _routes = funcInfo.routes || [];
    const properties = {
      functionName: { type: 'string', description: `Function name: ${funcInfo.name}` },
      routePath: { type: 'string', description: 'Route path to invoke' },
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        description: 'HTTP method',
      },
      body: { type: 'object', description: 'Request body (for POST/PUT/PATCH)' },
      query: { type: 'object', description: 'Query parameters' },
      params: { type: 'object', description: 'Path parameters' },
    };

    const required = ['functionName', 'routePath', 'method'];

    return { properties, required, type: 'object' };
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = [];

      for (const [name, funcInfo] of this.loadedFunctions) {
        for (const route of funcInfo.routes || []) {
          for (const method of route.methods || ['GET', 'POST']) {
            const toolName = `${name}__${route.path.replace(/[/:]/g, '_').replace(/^_/, '')}__${method.toLowerCase()}`;
            tools.push({
              name: toolName,
              description: `Invoke ${method} ${route.path} on function ${name}`,
              inputSchema: this.buildToolSchema(funcInfo),
            });
          }
        }
      }

      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (!this.invokeFunction) {
        return {
          content: [{ type: 'text', text: 'Function invoker not configured' }],
          isError: true,
        };
      }

      const parts = name.split('__');
      if (parts.length < 2) {
        return {
          content: [{ type: 'text', text: `Invalid tool name format: ${name}` }],
          isError: true,
        };
      }

      const functionName = parts[0];
      const method = parts[parts.length - 1].toUpperCase();
      const routePath = '/' + parts.slice(1, -1).join('/');

      if (!VALID_METHODS.includes(method)) {
        return {
          content: [
            {
              type: 'text',
              text: `Invalid HTTP method: ${method}. Must be one of: ${VALID_METHODS.join(', ')}`,
            },
          ],
          isError: true,
        };
      }

      const funcInfo = this.loadedFunctions.get(functionName);
      if (!funcInfo) {
        return {
          content: [{ type: 'text', text: `Function '${functionName}' not found` }],
          isError: true,
        };
      }

      try {
        const result = await this.invokeFunction(functionName, {
          method,
          routePath,
          body: args?.body || {},
          query: args?.query || {},
          params: args?.params || {},
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error(`MCP tool invocation error for ${name}: ${error.message}`, {
          stack: error.stack,
        });
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    });
  }

  async runStdio() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('FuncDock MCP server running on stdio');
  }

  async runHTTP(port = 3001) {
    // Refuse to expose MCP externally without authentication.
    const isLoopback = MCP_HTTP_HOST === '127.0.0.1' || MCP_HTTP_HOST === 'localhost';
    if (!isLoopback && !MCP_API_KEY) {
      throw new Error(
        `MCP HTTP refusing to bind on ${MCP_HTTP_HOST} without MCP_API_KEY. ` +
          `Set MCP_API_KEY to a strong random value, or leave MCP_HTTP_HOST as 127.0.0.1.`
      );
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => Math.random().toString(36).substring(2, 15),
    });

    await this.server.connect(transport);

    const server = createServer(async (req, res) => {
      try {
        if (MCP_API_KEY) {
          const authHeader = req.headers.authorization || '';
          const providedKey = authHeader.substring(7);
          if (
            !authHeader.startsWith('Bearer ') ||
            providedKey.length !== MCP_API_KEY.length ||
            !crypto.timingSafeEqual(Buffer.from(providedKey), Buffer.from(MCP_API_KEY))
          ) {
            res.statusCode = 401;
            res.setHeader('WWW-Authenticate', 'Bearer');
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
          }
        }
        await transport.handleRequest(req, res);
      } catch (error) {
        logger.error(`MCP HTTP transport error: ${error.message}`);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });

    this.httpServer = server;
    server.listen(port, MCP_HTTP_HOST);
    logger.info(
      `FuncDock MCP server running on HTTP ${MCP_HTTP_HOST}:${port}` +
        (MCP_API_KEY ? ' (Bearer auth required)' : ' (loopback only)')
    );
    return server;
  }

  async stop() {
    if (this.httpServer) {
      return new Promise((resolve) => {
        this.httpServer.close(() => {
          this.httpServer = null;
          resolve();
        });
      });
    }
  }
}

export default FuncDockMCPServer;
