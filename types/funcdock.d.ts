import type { Request, Response, NextFunction } from 'express';
import type { Logger } from '../utils/logger.js';

export interface FuncDockRequest extends Request {
  functionName: string;
  functionPath: string;
  routePath: string;
  routeHandler: string;
  logger: Logger;
  env: Record<string, string>;
  bodyRaw?: string;
}

export type FuncDockResponse = Response;

export type FuncDockNext = NextFunction;

export interface FuncDockHandler {
  (_req: FuncDockRequest, _res: FuncDockResponse, _next?: FuncDockNext): Promise<void> | void;
}

export interface CronHandlerRequest {
  cronJob: string;
  schedule: string;
  jobName: string;
  functionName: string;
  functionPath: string;
  logger: Logger;
  env: Record<string, string>;
}

export interface CronHandler {
  (_req: CronHandlerRequest): Promise<void> | void;
}
