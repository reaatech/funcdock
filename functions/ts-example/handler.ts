import type { FuncDockRequest, FuncDockResponse } from '../../types/funcdock.js';

export default async function handler(req: FuncDockRequest, res: FuncDockResponse) {
  if (req.method === 'GET') {
    res.json({
      message: 'Hello from TypeScript!',
      function: req.functionName,
      route: req.routePath,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (req.method === 'POST') {
    const { name } = req.body;
    res.json({
      message: `Welcome, ${name || 'anonymous'}!`,
      function: req.functionName,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
