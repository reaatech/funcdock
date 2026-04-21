/**
 * funcdock deploy — Deploy a function
 */

import { parseArgs } from 'util';
import { run as exec, log, colors, validateFunctionName } from '../utils.js';

export const name = 'deploy';
export const description = 'Deploy a function';

export async function run(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        git: { type: 'string' },
        local: { type: 'string' },
        pr: { type: 'string' },
        'pr-number': { type: 'string' },
        name: { type: 'string' },
        branch: { type: 'string' },
        commit: { type: 'string' },
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
    log(`\n${colors.cyan}funcdock deploy${colors.reset}\n`, 'reset');
    log('Deploy a function to the FuncDock platform.\n', 'gray');
    log('Usage: funcdock deploy --<source> [options]\n', 'yellow');
    log('Sources:', 'yellow');
    log(
      `  ${colors.green}--git <url>         ${colors.reset}Deploy from a Git repository`,
      'reset'
    );
    log(
      `  ${colors.green}--local <path>      ${colors.reset}Deploy from a local directory`,
      'reset'
    );
    log(`  ${colors.green}--pr <url>          ${colors.reset}Deploy from a pull request`, 'reset');
    log('\nOptions:', 'yellow');
    log(`  ${colors.green}--name <name>       ${colors.reset}Function name (required)`, 'reset');
    log(`  ${colors.green}--branch <name>     ${colors.reset}Git branch (default: main)`, 'reset');
    log(`  ${colors.green}--commit <hash>     ${colors.reset}Specific commit hash`, 'reset');
    log(
      `  ${colors.green}--pr-number <n>     ${colors.reset}PR number (required with --pr)\n`,
      'reset'
    );
    log('Examples:', 'yellow');
    log('  funcdock deploy --git https://github.com/user/repo.git --name my-func', 'gray');
    log('  funcdock deploy --local ./my-function --name my-func', 'gray');
    log(
      '  funcdock deploy --pr https://github.com/user/repo --name my-func --pr-number 42\n',
      'gray'
    );
    return;
  }

  const { git, local, pr, name, branch, commit } = parsed.values;
  const prNumber = parsed.values['pr-number'];

  const sources = [git, local, pr].filter(Boolean);
  if (sources.length === 0) {
    log(
      `${colors.red}Error: Must specify one source: --git, --local, or --pr${colors.reset}`,
      'reset'
    );
    log('Run `funcdock deploy --help` for usage.\n', 'gray');
    process.exit(2);
  }
  if (sources.length > 1) {
    log(`${colors.red}Error: Only one source allowed at a time${colors.reset}`, 'reset');
    process.exit(2);
  }

  if (!name) {
    log(`${colors.red}Error: --name is required${colors.reset}`, 'reset');
    process.exit(2);
  }

  if (!validateFunctionName(name)) {
    log(`${colors.red}Invalid function name: "${name}"${colors.reset}`, 'reset');
    process.exit(2);
  }

  const deployArgs = ['scripts/deploy.js'];

  if (git) {
    deployArgs.push('--git', git);
  } else if (local) {
    deployArgs.push('--local', local);
  } else if (pr) {
    deployArgs.push('--pr', pr);
    if (prNumber) deployArgs.push('--pr-number', prNumber);
  }

  deployArgs.push('--name', name);
  if (branch) deployArgs.push('--branch', branch);
  if (commit) deployArgs.push('--commit', commit);

  log(`📦 Deploying function "${name}"...`, 'blue');
  await exec('node', deployArgs);
}
