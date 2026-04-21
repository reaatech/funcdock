/**
 * funcdock list — List all deployed functions
 */

import { run as exec, log, colors } from '../utils.js';

export const name = 'list';
export const description = 'List all deployed functions';

export async function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    log(`\n${colors.cyan}funcdock list${colors.reset}\n`, 'reset');
    log('List all deployed functions.\n', 'gray');
    log('Usage: funcdock list\n', 'yellow');
    return;
  }

  log('📋 Listing deployed functions...', 'blue');
  await exec('node', ['scripts/deploy.js', '--list']);
}
