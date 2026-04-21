/**
 * Shared CLI utilities
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.dirname(__dirname);

export const colors = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  reset: '\x1b[0m',
};

export function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

export function error(message) {
  console.error(`${colors.red}❌ ${message}${colors.reset}`);
}

export function success(message) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

export function info(message) {
  console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

export function warn(message) {
  console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

/**
 * Run a command with inherited stdio
 */
export function run(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: projectRoot,
      ...options,
    });
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command exited with code ${code}`));
      } else {
        resolve();
      }
    });
    child.on('error', reject);
  });
}

/**
 * Run a command and capture stdout
 */
export function runCapture(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const child = spawn(command, args, {
      cwd: projectRoot,
      ...options,
    });
    child.stdout?.on('data', (d) => {
      stdout += d;
    });
    child.stderr?.on('data', (d) => {
      stderr += d;
    });
    child.on('close', (code) => {
      resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
    child.on('error', reject);
  });
}

export const FUNCTION_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

export function validateFunctionName(name) {
  if (!name || typeof name !== 'string') return false;
  return FUNCTION_NAME_REGEX.test(name) && name.length <= 100;
}

export async function loadEnv() {
  try {
    const { existsSync, readFileSync } = await import('fs');
    const envPath = path.join(projectRoot, '.env');
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
        }
      }
    }
  } catch {
    // ignore
  }
}
