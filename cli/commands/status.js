/**
 * funcdock status — Check platform status
 */

import { runCapture, log, colors, loadEnv } from '../utils.js';

export const name = 'status';
export const description = 'Check platform status';

export async function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    log(`\n${colors.cyan}funcdock status${colors.reset}\n`, 'reset');
    log('Query the FuncDock platform status endpoint.\n', 'gray');
    log('Usage: funcdock status\n', 'yellow');
    return;
  }

  await loadEnv();
  const port = process.env.PORT || '3000';
  const url = `http://localhost:${port}/api/status`;

  log(`📊 Checking platform status at ${url}...`, 'blue');
  const curlArgs = ['-s'];
  if (process.env.DEPLOY_API_KEY) {
    curlArgs.push('-H', `x-deploy-api-key: ${process.env.DEPLOY_API_KEY}`);
  }
  curlArgs.push(url);
  const { code, stdout, stderr } = await runCapture('curl', curlArgs);

  if (code !== 0 || stderr) {
    log(`${colors.red}❌ Platform is not responding on port ${port}${colors.reset}`, 'reset');
    log('Is the server running? Try: funcdock dev', 'gray');
    process.exit(1);
  }

  try {
    const data = JSON.parse(stdout);
    log(`${colors.green}✅ Platform is running${colors.reset}`, 'reset');
    log(`   Status: ${data.status || 'ok'}`, 'gray');
    log(`   Port:   ${port}`, 'gray');
    if (data.functions) log(`   Functions: ${data.functions}`, 'gray');
    if (data.uptime) log(`   Uptime: ${data.uptime}`, 'gray');
  } catch {
    log(`${colors.green}✅ Platform responded:${colors.reset} ${stdout}`, 'reset');
  }
}
