/**
 * funcdock logs — View application logs
 */

import { parseArgs } from 'util';
import { run as exec, log, colors } from '../utils.js';

export const name = 'logs';
export const description = 'View application logs';

export async function run(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        follow: { type: 'boolean', short: 'f' },
        error: { type: 'boolean', short: 'e' },
        help: { type: 'boolean', short: 'h' },
      },
      allowPositionals: false,
      strict: false,
    });
  } catch (err) {
    log(`${colors.red}Error: ${err.message}${colors.reset}`, 'reset');
    process.exit(2);
  }

  if (parsed.values.help) {
    log(`\n${colors.cyan}funcdock logs${colors.reset}\n`, 'reset');
    log('View application logs.\n', 'gray');
    log('Usage: funcdock logs [options]\n', 'yellow');
    log('Options:', 'yellow');
    log(`  ${colors.green}-f, --follow  ${colors.reset}Follow log output (tail -f)`, 'reset');
    log(`  ${colors.green}-e, --error   ${colors.reset}Show error logs only`, 'reset');
    log(`  ${colors.green}-h, --help    ${colors.reset}Show help\n`, 'reset');
    return;
  }

  if (parsed.values.error) {
    log('🚨 Showing error logs...', 'blue');
    if (parsed.values.follow) {
      await exec('npm', ['run', 'error-logs']);
    } else {
      const { runCapture } = await import('../utils.js');
      const { stdout } = await runCapture('cat', ['logs/error.log']);
      console.log(stdout || 'No error logs yet.');
    }
  } else {
    log('📄 Showing application logs...', 'blue');
    if (parsed.values.follow) {
      await exec('npm', ['run', 'logs']);
    } else {
      const { runCapture } = await import('../utils.js');
      const { stdout } = await runCapture('cat', ['logs/app.log']);
      console.log(stdout || 'No logs yet.');
    }
  }
}
