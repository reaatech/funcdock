/**
 * funcdock setup — Run initial platform setup
 */

import { run as exec, log, colors } from '../utils.js';

export const name = 'setup';
export const description = 'Run initial platform setup';

export async function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    log(`\n${colors.cyan}funcdock setup${colors.reset}\n`, 'reset');
    log('Creates required directories, generates .env, and prepares the platform.\n', 'gray');
    log('Usage: funcdock setup\n', 'yellow');
    return;
  }

  log('🚀 Running platform setup...', 'blue');
  await exec('node', ['scripts/setup.js']);
}
