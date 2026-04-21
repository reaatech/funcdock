/**
 * funcdock test [function] — Run tests
 */

import { parseArgs } from 'util';
import { run as exec, log, colors, validateFunctionName } from '../utils.js';

export const name = 'test';
export const description = 'Run tests (Jest)';

export async function run(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        docker: { type: 'boolean', short: 'd' },
        watch: { type: 'boolean', short: 'w' },
        coverage: { type: 'boolean', short: 'c' },
        help: { type: 'boolean', short: 'h' },
      },
      allowPositionals: true,
      strict: false,
    });
  } catch (err) {
    log(`${colors.red}Error: ${err.message}${colors.reset}`, 'reset');
    process.exit(2);
  }

  const [functionName] = parsed.positionals;

  if (parsed.values.help) {
    log(`\n${colors.cyan}funcdock test [function]${colors.reset}\n`, 'reset');
    log('Run Jest tests for a function or the entire platform.\n', 'gray');
    log('Usage: funcdock test [function-name] [options]\n', 'yellow');
    log('Options:', 'yellow');
    log(
      `  ${colors.green}-d, --docker   ${colors.reset}Run tests in a Dockerized prod-like environment`,
      'reset'
    );
    log(`  ${colors.green}-w, --watch    ${colors.reset}Run tests in watch mode`, 'reset');
    log(`  ${colors.green}-c, --coverage ${colors.reset}Generate coverage report`, 'reset');
    log(`  ${colors.green}-h, --help     ${colors.reset}Show help\n`, 'reset');
    log('Examples:', 'yellow');
    log('  funcdock test                          Run all tests', 'gray');
    log('  funcdock test hello-world              Test a specific function', 'gray');
    log('  funcdock test hello-world --docker     Test in Docker', 'gray');
    log('  funcdock test --coverage               Generate coverage\n', 'gray');
    return;
  }

  if (parsed.values.docker) {
    if (!functionName) {
      log(`${colors.red}Error: Function name required for Docker tests${colors.reset}`, 'reset');
      process.exit(2);
    }
    const funcPath = `./functions/${functionName}`;
    log(`🧪 Running Docker tests for ${functionName}...`, 'blue');
    await exec('node', ['scripts/test-function-in-docker.js', '--function', funcPath]);
    return;
  }

  if (functionName) {
    if (!validateFunctionName(functionName)) {
      log(`${colors.red}Invalid function name: "${functionName}"${colors.reset}`, 'reset');
      process.exit(2);
    }
    log(`🧪 Testing function "${functionName}"...`, 'blue');
    const jestArgs = [`functions/${functionName}`];
    if (parsed.values.watch) jestArgs.push('--watch');
    if (parsed.values.coverage) jestArgs.push('--coverage');
    await exec('node', ['--experimental-vm-modules', 'node_modules/.bin/jest', ...jestArgs]);
  } else {
    log('🧪 Running all tests...', 'blue');
    if (parsed.values.coverage) {
      await exec('npm', ['run', 'test:coverage']);
    } else if (parsed.values.watch) {
      await exec('npm', ['run', 'test:watch']);
    } else {
      await exec('npm', ['test']);
    }
  }
}
