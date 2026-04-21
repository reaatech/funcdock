/**
 * funcdock remove <name> — Remove a deployed function
 */

import { run as exec, log, colors, validateFunctionName } from '../utils.js';

export const name = 'remove';
export const description = 'Remove a deployed function';

export async function run(args) {
  const [name] = args.filter((a) => !a.startsWith('-'));

  if (!name || args.includes('--help') || args.includes('-h')) {
    log(`\n${colors.cyan}funcdock remove <name>${colors.reset}\n`, 'reset');
    log('Remove a deployed function from the platform.\n', 'gray');
    log('Usage: funcdock remove <function-name>\n', 'yellow');
    log('Example: funcdock remove old-function\n', 'gray');
    return;
  }

  if (!validateFunctionName(name)) {
    log(`${colors.red}Invalid function name: "${name}"${colors.reset}`, 'reset');
    process.exit(2);
  }

  log(`🗑️  Removing function "${name}"...`, 'blue');
  await exec('node', ['scripts/deploy.js', '--remove', name]);
}
