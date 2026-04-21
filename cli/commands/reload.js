/**
 * funcdock reload — Reload all functions
 */

import { runCapture, log, colors, loadEnv } from '../utils.js';

export const name = 'reload';
export const description = 'Reload all functions';

export async function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    log(`\n${colors.cyan}funcdock reload${colors.reset}\n`, 'reset');
    log('Trigger a hot reload of all functions via the API.\n', 'gray');
    log('Usage: funcdock reload\n', 'yellow');
    return;
  }

  await loadEnv();
  const port = process.env.PORT || '3000';
  const url = `http://localhost:${port}/api/reload`;

  log('🔄 Reloading all functions...', 'blue');
  const curlArgs = ['-s', '-X', 'POST', '-H', 'Content-Type: application/json'];
  if (process.env.DEPLOY_API_KEY) {
    curlArgs.push('-H', `x-deploy-api-key: ${process.env.DEPLOY_API_KEY}`);
  }
  curlArgs.push(url);
  const { code, stdout } = await runCapture('curl', curlArgs);

  if (code !== 0) {
    log(`${colors.red}❌ Failed to trigger reload${colors.reset}`, 'reset');
    process.exit(1);
  }

  log(`${colors.green}✅ Reload triggered${colors.reset}`, 'reset');
  if (stdout) log(`   Response: ${stdout}`, 'gray');
}
