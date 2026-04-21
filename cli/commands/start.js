/**
 * funcdock start — Start production server
 */

import { run as exec, log, colors } from '../utils.js';

export const name = 'start';
export const description = 'Start production server';

export async function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    log(`\n${colors.cyan}funcdock start${colors.reset}\n`, 'reset');
    log('Start the FuncDock platform in production mode.\n', 'gray');
    log('Usage: funcdock start\n', 'yellow');
    return;
  }

  log('🚀 Starting production server...', 'blue');
  await exec('npm', ['start']);
}
