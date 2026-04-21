#!/usr/bin/env node

/**
 * Host-based Deployment Script for FuncDock
 *
 * This script handles Git operations on the host (with your credentials)
 * and then syncs the function to the container's mounted volume.
 *
 * Usage:
 *   npm run deploy-host -- --git <repo-url> --name <function-name>
 *   npm run deploy-host -- --update <function-name>
 *   npm run deploy-host -- --update <function-name> --branch <branch>
 *   npm run deploy-host -- --update <function-name> --commit <commit-hash>
 *   npm run deploy-host -- --pr <repo-url> --name <function-name> --pr-number <number>
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { validateFunctionDeployment } from '../utils/test-runner.js';
import { safeDeploy, listBackups, manualRollback } from '../utils/deployment-backup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(__dirname);
const functionsDir = path.join(projectRoot, 'functions');

const tempDir = path.join(projectRoot, '.temp-deploy');

const colors = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

const FUNCTION_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

function validateFunctionName(name) {
  if (!name || typeof name !== 'string') return false;
  return FUNCTION_NAME_REGEX.test(name) && name.length <= 100;
}

function showUsage() {
  log('\n🏠 Host-based FuncDock Function Deployment Tool', 'blue');
  log('\nThis tool handles Git operations on the host and syncs to the container.', 'yellow');
  log('\nUsage:', 'yellow');
  log('  npm run deploy-host -- --git <repo-url> --name <function-name>', 'blue');
  log(
    '  npm run deploy-host -- --pr <repo-url> --name <function-name> --pr-number <number>',
    'blue'
  );
  log('  npm run deploy-host -- --update <function-name>', 'blue');
  log('  npm run deploy-host -- --update <function-name> --branch <branch>', 'blue');
  log('  npm run deploy-host -- --update <function-name> --commit <commit-hash>', 'blue');
  log('  npm run deploy-host -- --list', 'blue');
  log('  npm run deploy-host -- --remove <function-name>', 'blue');
  log('  npm run deploy-host -- --backups [function-name]', 'blue');
  log('  npm run deploy-host -- --rollback <backup-name>', 'blue');

  log('\nOptions:', 'yellow');
  log('  --git <url>       Deploy from Git repository (uses host credentials)', 'blue');
  log('  --pr <url>        Deploy from a specific pull request', 'blue');
  log('  --pr-number <n>   Pull request number (required with --pr)', 'blue');
  log('  --name <name>     Function name (required for git/pr)', 'blue');
  log('  --branch <name>   Git branch to deploy (default: main)', 'blue');
  log('  --commit <hash>   Deploy from specific commit hash', 'blue');
  log('  --list            List all deployed functions', 'blue');
  log('  --remove <name>   Remove a deployed function', 'blue');
  log('  --update <name>   Update an existing function from its source', 'blue');
  log('  --help            Show this help message', 'blue');

  log('\nExamples:', 'yellow');
  log(
    '  npm run deploy-host -- --git https://github.com/user/my-function.git --name my-function',
    'blue'
  );
  log(
    '  npm run deploy-host -- --pr https://github.com/user/my-function.git --name my-function --pr-number 123',
    'blue'
  );
  log('  npm run deploy-host -- --update my-function', 'blue');
  log('  npm run deploy-host -- --update my-function --branch feature/new-feature', 'blue');
  log('  npm run deploy-host -- --update my-function --commit abc123def', 'blue');
  log('  npm run deploy-host -- --remove old-function', 'blue');
  log('  npm run deploy-host -- --backups my-function', 'blue');
  log('  npm run deploy-host -- --rollback my-function-2025-06-30T22-56-12-364Z', 'blue');

  log('\nNote: This tool uses your host Git credentials and syncs to the container.', 'yellow');
}

async function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--git':
        options.git = args[++i];
        break;
      case '--pr':
        options.pr = args[++i];
        break;
      case '--pr-number':
        options.prNumber = args[++i];
        break;
      case '--name':
        options.name = args[++i];
        break;
      case '--branch':
        options.branch = args[++i] || 'main';
        break;
      case '--commit':
        options.commit = args[++i];
        break;
      case '--list':
        options.list = true;
        break;
      case '--remove':
        options.remove = args[++i];
        break;
      case '--update':
        options.update = args[++i];
        break;
      case '--backups':
        options.backups = args[++i] || true;
        break;
      case '--rollback':
        options.rollback = args[++i];
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }

  return options;
}

function spawnAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data;
    });
    child.stderr.on('data', (data) => {
      stderr += data;
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error = new Error(stderr.trim() || `Command failed with exit code ${code}`);
        error.code = code;
        error.stderr = stderr;
        reject(error);
      }
    });

    child.on('error', reject);
  });
}

async function validateFunction(functionPath) {
  const requiredFiles = ['route.config.json', 'package.json'];
  const missing = [];

  for (const file of requiredFiles) {
    try {
      await fs.access(path.join(functionPath, file));
    } catch {
      missing.push(file);
    }
  }

  const hasJsHandler = await fs
    .access(path.join(functionPath, 'handler.js'))
    .then(() => true)
    .catch(() => false);
  const hasTsHandler = await fs
    .access(path.join(functionPath, 'handler.ts'))
    .then(() => true)
    .catch(() => false);
  if (!hasJsHandler && !hasTsHandler) {
    missing.push('handler.js (or handler.ts)');
  }

  return missing;
}

async function checkHostGitCredentials(gitUrl) {
  try {
    log(`🔍 Checking host Git credentials for: ${gitUrl}`, 'blue');

    await spawnAsync('git', ['ls-remote', '--exit-code', gitUrl], { timeout: 10000 });
    log(`✅ Host Git credentials verified - repository is accessible`, 'green');
    return true;
  } catch (error) {
    if (error.code === 128) {
      log(`❌ Host Git credentials required for: ${gitUrl}`, 'red');
      log(`💡 Configure your Git credentials:`, 'yellow');
      log(`   1. Set up Git user: git config --global user.name "Your Name"`, 'blue');
      log(
        `   2. Set up Git email: git config --global user.email "your.email@example.com"`,
        'blue'
      );
      log(`   3. Store credentials: git config --global credential.helper store`, 'blue');
      log(`   4. Or use SSH keys: ssh-keygen -t ed25519 -C "your.email@example.com"`, 'blue');
      log(`   5. Test access: git ls-remote ${gitUrl}`, 'blue');
      return false;
    } else if (error.code === 'ETIMEDOUT') {
      log(`⏰ Timeout checking repository - network issue or repository doesn't exist`, 'yellow');
      return false;
    } else {
      log(`⚠️  Could not verify host Git credentials: ${error.message}`, 'yellow');
      return false;
    }
  }
}

async function ensureTempDir() {
  try {
    await fs.mkdir(tempDir, { recursive: true });
  } catch (error) {
    log(`❌ Failed to create temp directory: ${error.message}`, 'red');
    throw error;
  }
}

async function cleanupTempDir() {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    log(`⚠️  Warning: Could not cleanup temp directory: ${error.message}`, 'yellow');
  }
}

async function deployFromGit(gitUrl, functionName, branch = 'main', commit = null) {
  log(`🔄 Deploying function "${functionName}" from Git: ${gitUrl}`, 'blue');
  log(`📋 Using host Git credentials for authentication`, 'yellow');
  if (commit) {
    log(`📌 Deploying from commit: ${commit}`, 'yellow');
  } else {
    log(`🌿 Using branch: ${branch}`, 'yellow');
  }

  const hasCredentials = await checkHostGitCredentials(gitUrl);
  if (!hasCredentials) {
    throw new Error('Host Git credentials required for this repository');
  }

  const functionPath = path.join(functionsDir, functionName);
  const tempFunctionPath = path.join(tempDir, functionName);

  const deploymentFunction = async () => {
    await ensureTempDir();

    try {
      await fs.rm(tempFunctionPath, { recursive: true, force: true });
    } catch {
      // Doesn't exist, that's fine
    }

    log(`📥 Cloning repository to temp directory...`, 'blue');
    await spawnAsync('git', ['clone', '--branch', branch, gitUrl, tempFunctionPath]);

    if (commit) {
      log(`🔍 Checking out commit: ${commit}`, 'blue');
      await spawnAsync('git', ['checkout', commit], { cwd: tempFunctionPath });
    }

    const { stdout: currentCommit } = await spawnAsync('git', ['rev-parse', 'HEAD'], {
      cwd: tempFunctionPath,
    });
    const commitHash = currentCommit.trim();

    const missing = await validateFunction(tempFunctionPath);
    if (missing.length > 0) {
      throw new Error(`Missing required files: ${missing.join(', ')}`);
    }

    try {
      await fs.rm(functionPath, { recursive: true, force: true });
      log(`🗑️  Removed existing function: ${functionName}`, 'yellow');
    } catch {
      // Function doesn't exist, that's fine
    }

    log(`📁 Copying function to container...`, 'blue');
    await fs.cp(tempFunctionPath, functionPath, { recursive: true, force: true });

    const metadata = {
      source: 'git',
      gitUrl,
      branch,
      commit: commitHash,
      deployedAt: new Date().toISOString(),
      deployedBy: process.env.USER || 'unknown',
      deploymentMethod: 'host-based',
    };

    await fs.writeFile(
      path.join(functionPath, '.deployment.json'),
      JSON.stringify(metadata, null, 2)
    );
  };

  const validationFunction = async () => {
    return await validateFunctionDeployment(functionPath, functionName);
  };

  const result = await safeDeploy(functionName, deploymentFunction, validationFunction);

  try {
    if (result.success) {
      log(`✅ Successfully deployed function: ${functionName}`, 'green');
      log(`🔄 Function will be automatically loaded by the container`, 'blue');
      await reloadFunction(functionName);
    } else {
      log(`❌ Deployment failed and was rolled back: ${result.error}`, 'red');
      log(`🚨 ALERT: Function ${functionName} deployment failed due to test failures!`, 'red');
      log(`📦 Backup available for manual recovery if needed.`, 'yellow');
    }

    if (!result.success) {
      throw new Error(result.error);
    }
  } finally {
    await cleanupTempDir();
  }
}

async function deployFromPullRequest(gitUrl, functionName, prNumber) {
  log(`🔄 Deploying function "${functionName}" from Pull Request #${prNumber}`, 'blue');
  log(`📋 Using host Git credentials for authentication`, 'yellow');

  const hasCredentials = await checkHostGitCredentials(gitUrl);
  if (!hasCredentials) {
    throw new Error('Host Git credentials required for this repository');
  }

  const functionPath = path.join(functionsDir, functionName);
  const tempFunctionPath = path.join(tempDir, functionName);

  const deploymentFunction = async () => {
    await ensureTempDir();

    try {
      await fs.rm(tempFunctionPath, { recursive: true, force: true });
    } catch {
      // Doesn't exist, that's fine
    }

    log(`📥 Cloning repository to temp directory...`, 'blue');
    await spawnAsync('git', ['clone', gitUrl, tempFunctionPath]);

    log(`📥 Fetching pull request #${prNumber}...`, 'blue');
    await spawnAsync('git', ['fetch', 'origin', `pull/${prNumber}/head:pr-${prNumber}`], {
      cwd: tempFunctionPath,
    });

    log(`🔍 Checking out pull request branch...`, 'blue');
    await spawnAsync('git', ['checkout', `pr-${prNumber}`], { cwd: tempFunctionPath });

    const { stdout: currentCommit } = await spawnAsync('git', ['rev-parse', 'HEAD'], {
      cwd: tempFunctionPath,
    });
    const commitHash = currentCommit.trim();

    let prTitle = `PR #${prNumber}`;
    try {
      const { stdout: prInfo } = await spawnAsync('git', ['log', '--oneline', '-1'], {
        cwd: tempFunctionPath,
      });
      prTitle = prInfo.trim();
    } catch {
      // Ignore if we can't get PR title
    }

    const missing = await validateFunction(tempFunctionPath);
    if (missing.length > 0) {
      throw new Error(`Missing required files: ${missing.join(', ')}`);
    }

    try {
      await fs.rm(functionPath, { recursive: true, force: true });
      log(`🗑️  Removed existing function: ${functionName}`, 'yellow');
    } catch {
      // Function doesn't exist, that's fine
    }

    log(`📁 Copying function to container...`, 'blue');
    await fs.cp(tempFunctionPath, functionPath, { recursive: true, force: true });

    const metadata = {
      source: 'pull-request',
      gitUrl,
      prNumber: parseInt(prNumber),
      prTitle,
      commit: commitHash,
      deployedAt: new Date().toISOString(),
      deployedBy: process.env.USER || 'unknown',
      deploymentMethod: 'host-based',
    };

    await fs.writeFile(
      path.join(functionPath, '.deployment.json'),
      JSON.stringify(metadata, null, 2)
    );
  };

  const validationFunction = async () => {
    return await validateFunctionDeployment(functionPath, functionName);
  };

  const result = await safeDeploy(functionName, deploymentFunction, validationFunction);

  try {
    if (result.success) {
      log(`✅ Successfully deployed function: ${functionName} from PR #${prNumber}`, 'green');
      log(`🔄 Function will be automatically loaded by the container`, 'blue');
      await reloadFunction(functionName);
    } else {
      log(`❌ Deployment failed and was rolled back: ${result.error}`, 'red');
      log(`🚨 ALERT: Function ${functionName} deployment failed due to test failures!`, 'red');
      log(`📦 Backup available for manual recovery if needed.`, 'yellow');
    }

    if (!result.success) {
      throw new Error(result.error);
    }
  } finally {
    await cleanupTempDir();
  }
}

async function updateFunction(functionName, options = {}) {
  log(`🔄 Updating function: ${functionName}`, 'blue');

  const functionPath = path.join(functionsDir, functionName);
  const metadataPath = path.join(functionPath, '.deployment.json');

  try {
    await fs.access(functionPath);

    const metadataContent = await fs.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(metadataContent);

    if (metadata.source === 'git' || metadata.source === 'pull-request') {
      const { gitUrl, branch = 'main' } = metadata;

      const targetBranch = options.branch || branch;
      const targetCommit = options.commit || null;

      if (targetCommit) {
        log(`📌 Updating to specific commit: ${targetCommit}`, 'yellow');
      } else if (options.branch && options.branch !== branch) {
        log(`🌿 Switching from branch ${branch} to ${targetBranch}`, 'yellow');
      }

      await deployFromGit(gitUrl, functionName, targetBranch, targetCommit);
    } else {
      log(`⚠️  Cannot update function with source: ${metadata.source}`, 'yellow');
      log(`   Use the original deployment method for this function.`, 'yellow');
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      log(`❌ Function "${functionName}" not found`, 'red');
    } else {
      log(`❌ Failed to update function: ${error.message}`, 'red');
    }
    throw error;
  }
}

async function removeFunction(functionName) {
  log(`🗑️  Removing function: ${functionName}`, 'yellow');

  const functionPath = path.join(functionsDir, functionName);

  try {
    await fs.rm(functionPath, { recursive: true, force: true });
    log(`✅ Successfully removed function: ${functionName}`, 'green');

    await reloadFunction();
  } catch (error) {
    log(`❌ Failed to remove function: ${error.message}`, 'red');
    throw error;
  }
}

async function listFunctions() {
  log('📋 Deployed Functions:', 'blue');

  try {
    const functions = await fs.readdir(functionsDir);

    if (functions.length === 0) {
      log('No functions deployed', 'yellow');
      return;
    }

    for (const functionName of functions) {
      const functionPath = path.join(functionsDir, functionName);
      const stats = await fs.stat(functionPath);

      if (!stats.isDirectory()) continue;

      const metadataPath = path.join(functionPath, '.deployment.json');
      let metadata = { source: 'unknown', deployedAt: 'unknown' };

      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        metadata = JSON.parse(metadataContent);
      } catch {
        // No metadata file
      }

      let routes = [];
      try {
        const configPath = path.join(functionPath, 'route.config.json');
        const configContent = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configContent);
        routes = config.routes || [];
      } catch {
        // No route config
      }

      log(`\n📦 ${functionName}`, 'green');
      log(`   Source: ${metadata.source}`, 'blue');
      log(`   Deployed: ${new Date(metadata.deployedAt).toLocaleString()}`, 'blue');
      log(`   Routes: ${routes.length}`, 'blue');

      if (metadata.gitUrl) {
        log(`   Git URL: ${metadata.gitUrl}`, 'blue');
        if (metadata.source === 'pull-request') {
          log(`   PR #${metadata.prNumber}: ${metadata.prTitle}`, 'blue');
        } else {
          log(`   Branch: ${metadata.branch || 'main'}`, 'blue');
        }
        if (metadata.commit) {
          log(`   Commit: ${metadata.commit.substring(0, 8)}`, 'blue');
        }
      }

      if (metadata.deploymentMethod) {
        log(`   Method: ${metadata.deploymentMethod}`, 'blue');
      }
    }
  } catch (error) {
    log(`❌ Failed to list functions: ${error.message}`, 'red');
    throw error;
  }
}

async function reloadFunction(functionName = null) {
  try {
    const port = process.env.PORT || '3000';
    const protocol = process.env.FUNCDOCK_SSL === 'true' ? 'https' : 'http';
    const reloadUrl = `${protocol}://localhost:${port}/api/reload`;
    const body = functionName ? JSON.stringify({ functionName }) : '{}';

    const headers = {
      'Content-Type': 'application/json',
    };

    if (process.env.DEPLOY_API_KEY) {
      headers['x-deploy-api-key'] = process.env.DEPLOY_API_KEY;
    }

    const res = await fetch(reloadUrl, {
      method: 'POST',
      headers,
      body,
    });

    const response = await res.json();
    if (response.success) {
      const message = functionName
        ? `Reloaded function: ${functionName}`
        : 'Reloaded all functions';
      log(`🔄 ${message}`, 'green');
    } else {
      log(`⚠️  Reload warning: ${response.message}`, 'yellow');
    }
  } catch (error) {
    log(`⚠️  Could not trigger reload: ${error.message}`, 'yellow');
    log('The function was deployed but you may need to restart the server', 'yellow');
  }
}

async function main() {
  const options = await parseArgs();

  if (options.help || Object.keys(options).length === 0) {
    showUsage();
    return;
  }

  try {
    await fs.mkdir(functionsDir, { recursive: true });

    if (options.list) {
      await listFunctions();
    } else if (options.remove) {
      if (!validateFunctionName(options.remove)) {
        throw new Error(
          'Invalid function name. Use only alphanumeric characters, hyphens, and underscores.'
        );
      }
      await removeFunction(options.remove);
    } else if (options.update) {
      if (!validateFunctionName(options.update)) {
        throw new Error(
          'Invalid function name. Use only alphanumeric characters, hyphens, and underscores.'
        );
      }
      const updateOptions = {};
      if (options.branch) updateOptions.branch = options.branch;
      if (options.commit) updateOptions.commit = options.commit;
      await updateFunction(options.update, updateOptions);
    } else if (options.backups) {
      await listBackups(options.backups === true ? null : options.backups);
    } else if (options.rollback) {
      const success = await manualRollback(options.rollback);
      if (!success) {
        process.exit(1);
      }
      log(`🔄 Reloading server after rollback...`, 'blue');
      await reloadFunction();
    } else if (options.git) {
      if (!options.name) {
        throw new Error('Function name is required when deploying from Git');
      }
      if (!validateFunctionName(options.name)) {
        throw new Error(
          'Invalid function name. Use only alphanumeric characters, hyphens, and underscores.'
        );
      }
      await deployFromGit(options.git, options.name, options.branch, options.commit);
    } else if (options.pr) {
      if (!options.name || !options.prNumber) {
        throw new Error(
          'Function name and pull request number are required when deploying from a pull request'
        );
      }
      if (!validateFunctionName(options.name)) {
        throw new Error(
          'Invalid function name. Use only alphanumeric characters, hyphens, and underscores.'
        );
      }
      await deployFromPullRequest(options.pr, options.name, options.prNumber);
    } else {
      log('❌ Invalid options. Use --help for usage information.', 'red');
      process.exit(1);
    }
  } catch (error) {
    log(`\n❌ Deployment failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

main().catch((err) => {
  log(`Unhandled error: ${err.message}`, 'red');
  process.exit(1);
});
