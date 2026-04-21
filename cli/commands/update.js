/**
 * funcdock update <name> — Update an existing function
 */

import { parseArgs } from 'util';
import { run as exec, log, colors, validateFunctionName } from '../utils.js';

export const name = 'update';
export const description = 'Update an existing function';

export async function run(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        branch: { type: 'string' },
        commit: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
      allowPositionals: true,
      strict: false,
    });
  } catch (err) {
    log(`${colors.red}Error: ${err.message}${colors.reset}`, 'reset');
    process.exit(2);
  }

  const [name] = parsed.positionals;

  if (!name || parsed.values.help) {
    log(`\n${colors.cyan}funcdock update <name>${colors.reset}\n`, 'reset');
    log('Update an existing function from its source.\n', 'gray');
    log('Usage: funcdock update <function-name> [options]\n', 'yellow');
    log('Options:', 'yellow');
    log(`  ${colors.green}--branch <name>  ${colors.reset}Update to a specific branch`, 'reset');
    log(`  ${colors.green}--commit <hash>  ${colors.reset}Update to a specific commit\n`, 'reset');
    log('Examples:', 'yellow');
    log('  funcdock update my-function', 'gray');
    log('  funcdock update my-function --branch feature/new-thing', 'gray');
    log('  funcdock update my-function --commit abc123\n', 'gray');
    return;
  }

  if (!validateFunctionName(name)) {
    log(`${colors.red}Invalid function name: "${name}"${colors.reset}`, 'reset');
    process.exit(2);
  }

  const deployArgs = ['scripts/deploy.js', '--update', name];
  if (parsed.values.branch) deployArgs.push('--branch', parsed.values.branch);
  if (parsed.values.commit) deployArgs.push('--commit', parsed.values.commit);

  log(`🔄 Updating function "${name}"...`, 'blue');
  await exec('node', deployArgs);
}
