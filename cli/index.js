/**
 * FuncDock CLI — Command registry and dispatcher
 */

import { log, colors } from './utils.js';

import * as dev from './commands/dev.js';
import * as start from './commands/start.js';
import * as create from './commands/create.js';
import * as deploy from './commands/deploy.js';
import * as update from './commands/update.js';
import * as remove from './commands/remove.js';
import * as list from './commands/list.js';
import * as test from './commands/test.js';
import * as logs from './commands/logs.js';
import * as status from './commands/status.js';
import * as setup from './commands/setup.js';
import * as reload from './commands/reload.js';

const commands = {
  dev,
  start,
  create,
  deploy,
  update,
  remove,
  list,
  test,
  logs,
  status,
  setup,
  reload,
};

const pkg = {
  name: 'funcdock',
  version: '2.0.0',
};

function showHelp() {
  log(`\n${colors.cyan}🚀 ${pkg.name} v${pkg.version}${colors.reset} — FuncDock CLI\n`, 'reset');
  log('Usage: funcdock <command> [options]\n', 'gray');
  log('Commands:', 'yellow');

  const maxName = Math.max(...Object.values(commands).map((c) => c.name.length));

  for (const [, cmd] of Object.entries(commands)) {
    const padded = cmd.name.padEnd(maxName + 2);
    log(`  ${colors.green}${padded}${colors.reset}${cmd.description}`, 'reset');
  }

  log('\nOptions:', 'yellow');
  log(`  ${colors.green}-h, --help     ${colors.reset}Show help`, 'reset');
  log(`  ${colors.green}-v, --version  ${colors.reset}Show version`, 'reset');

  log('\nExamples:', 'yellow');
  log('  funcdock dev                           Start development server', 'gray');
  log('  funcdock create my-api                 Scaffold a new function', 'gray');
  log('  funcdock deploy --git <url> --name x   Deploy from Git', 'gray');
  log('  funcdock test hello-world              Run function tests', 'gray');
  log('  funcdock status                        Check platform health', 'gray');
  log('');
}

export async function cli(argv) {
  const hasVersion = argv.includes('--version') || argv.includes('-v');
  const hasHelp = argv.includes('--help') || argv.includes('-h');
  const positionalArgs = argv.filter((a) => !a.startsWith('-'));
  const commandName = positionalArgs[0];

  if (hasVersion) {
    console.log(`${pkg.name} v${pkg.version}`);
    return;
  }

  if (!commandName && hasHelp) {
    showHelp();
    return;
  }

  if (!commandName) {
    showHelp();
    return;
  }

  const rest = argv.filter((a) => a !== commandName);

  const command = commands[commandName];

  if (!command) {
    log(`${colors.red}Unknown command: "${commandName}"${colors.reset}`, 'reset');
    const suggestions = Object.keys(commands).filter((k) => k.startsWith(commandName[0]));
    if (suggestions.length) {
      log(`Did you mean: ${suggestions.join(', ')}?`, 'yellow');
    }
    log('\nRun `funcdock --help` for available commands.', 'gray');
    process.exit(2);
  }

  // Hand off to the command module with remaining args
  try {
    await command.run(rest);
  } catch (err) {
    log(`${colors.red}${err.message}${colors.reset}`, 'reset');
    process.exit(1);
  }
}
