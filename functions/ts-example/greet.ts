import type { FuncDockRequest, FuncDockResponse } from '../../types/funcdock.js';

export default async function handler(req: FuncDockRequest, res: FuncDockResponse) {
  const { name } = req.params;
  res.json({
    message: `Hello, ${name}!`,
    function: req.functionName,
    route: req.routePath,
    timestamp: new Date().toISOString(),
  });
}
