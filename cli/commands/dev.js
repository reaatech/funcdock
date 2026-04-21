/**
 * funcdock dev — Start development server with hot reload
 */

import { run as exec, log, colors } from '../utils.js';

export const name = 'dev';
export const description = 'Start development server with hot reload';

export async function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    log(`\n${colors.cyan}funcdock dev${colors.reset}\n`, 'reset');
    log('Start the FuncDock platform in development mode.', 'gray');
    log('Watches server.js for changes and auto-restarts.\n', 'gray');
    log('Usage: funcdock dev\n', 'yellow');
    return;
  }

  log('🔧 Starting development server...', 'blue');
  await exec('npm', ['run', 'dev']);
}
