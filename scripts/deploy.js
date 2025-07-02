#!/usr/bin/env node

/**
 * Deployment Script for Serverless Functions
 * Supports deploying from Git repositories or local directories
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { validateFunctionDeployment } from '../utils/test-runner.js';
import { safeDeploy } from '../utils/deployment-backup.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(__dirname);
const functionsDir = path.join(projectRoot, 'functions');

const colors = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function showUsage() {
  log('\n📦 FuncDock Function Deployment Tool', 'blue');
  log('\nUsage:', 'yellow');
  log('  npm run deploy -- --git <repo-url> --name <function-name>', 'blue');
  log('  npm run deploy -- --pr <repo-url> --name <function-name> --pr-number <number>', 'blue');
  log('  npm run deploy -- --local <local-path> --name <function-name>', 'blue');
  log('  npm run deploy -- --list', 'blue');
  log('  npm run deploy -- --remove <function-name>', 'blue');
  log('  npm run deploy -- --update <function-name>', 'blue');
  log('  npm run deploy -- --update <function-name> --branch <branch>', 'blue');
  log('  npm run deploy -- --update <function-name> --commit <commit-hash>', 'blue');

  log('\nOptions:', 'yellow');
  log('  --git <url>       Deploy from Git repository', 'blue');
  log('  --pr <url>        Deploy from a specific pull request', 'blue');
  log('  --pr-number <n>   Pull request number (required with --pr)', 'blue');
  log('  --local <path>    Deploy from local directory', 'blue');
  log('  --name <name>     Function name (required for git/pr/local)', 'blue');
  log('  --branch <name>   Git branch to deploy (default: main)', 'blue');
  log('  --commit <hash>   Deploy from specific commit hash', 'blue');
  log('  --list            List all deployed functions', 'blue');
  log('  --remove <name>   Remove a deployed function', 'blue');
  log('  --update <name>   Update an existing function from its source', 'blue');
  log('  --help            Show this help message', 'blue');

  log('\nExamples:', 'yellow');
  log('  npm run deploy -- --git https://github.com/user/my-function.git --name my-function', 'blue');
  log('  npm run deploy -- --pr https://github.com/user/my-function.git --name my-function --pr-number 123', 'blue');
  log('  npm run deploy -- --local ./local-function --name local-func', 'blue');
  log('  npm run deploy -- --update my-function', 'blue');
  log('  npm run deploy -- --update my-function --branch feature/new-feature', 'blue');
  log('  npm run deploy -- --update my-function --commit abc123def', 'blue');
  log('  npm run deploy -- --remove old-function', 'blue');
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
      case '--local':
        options.local = args[++i];
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
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }

  return options;
}

async function validateFunction(functionPath) {
  const requiredFiles = ['handler.js', 'route.config.json', 'package.json'];
  const missing = [];

  for (const file of requiredFiles) {
    try {
      await fs.access(path.join(functionPath, file));
    } catch {
      missing.push(file);
    }
  }

  return missing;
}

async function checkGitCredentials(gitUrl) {
  try {
    log(`🔍 Checking Git credentials for: ${gitUrl}`, 'blue');
    
    // Test if we can access the repository without authentication
    await execAsync(`git ls-remote --exit-code ${gitUrl}`, { timeout: 10000 });
    log(`✅ Git credentials verified - repository is accessible`, 'green');
    return true;
  } catch (error) {
    if (error.code === 128) {
      log(`❌ Git credentials required for: ${gitUrl}`, 'red');
      log(`💡 Solutions:`, 'yellow');
      log(`   1. Use host-based deployment: make deploy-host-git REPO=${gitUrl} NAME=<function-name>`, 'blue');
      log(`   2. Configure Git credentials: git config --global credential.helper store`, 'blue');
      log(`   3. Use SSH keys: ssh-keygen -t ed25519 -C "your.email@example.com"`, 'blue');
      log(`   4. Use SSH URL: git@github.com:user/repo.git`, 'blue');
      return false;
    } else if (error.code === 'ETIMEDOUT') {
      log(`⏰ Timeout checking repository - network issue or repository doesn't exist`, 'yellow');
      return false;
    } else {
      log(`⚠️  Could not verify Git credentials: ${error.message}`, 'yellow');
      return false;
    }
  }
}

async function deployFromGit(gitUrl, functionName, branch = 'main', commit = null) {
  log(`🔄 Deploying function "${functionName}" from Git: ${gitUrl}`, 'blue');
  if (commit) {
    log(`📌 Deploying from commit: ${commit}`, 'yellow');
  } else {
    log(`🌿 Using branch: ${branch}`, 'yellow');
  }

  // Check Git credentials before attempting to clone
  const hasCredentials = await checkGitCredentials(gitUrl);
  if (!hasCredentials) {
    log(`💡 Tip: Use 'make deploy-host-git' to use your host Git credentials instead`, 'yellow');
    throw new Error('Git credentials required for this repository');
  }

  const functionPath = path.join(functionsDir, functionName);

  // Define the deployment function
  const deploymentFunction = async () => {
    // Remove existing function if it exists
    try {
      await fs.rm(functionPath, { recursive: true, force: true });
      log(`🗑️  Removed existing function: ${functionName}`, 'yellow');
    } catch {
      // Function doesn't exist, that's fine
    }

    // Clone the repository
    log(`📥 Cloning repository...`, 'blue');
    await execAsync(`git clone --branch ${branch} ${gitUrl} ${functionPath}`);

    // Checkout specific commit if provided
    if (commit) {
      log(`🔍 Checking out commit: ${commit}`, 'blue');
      await execAsync(`cd ${functionPath} && git checkout ${commit}`);
    }

    // Get current commit hash for metadata
    const { stdout: currentCommit } = await execAsync(`cd ${functionPath} && git rev-parse HEAD`);
    const commitHash = currentCommit.trim();

    // Validate function structure
    const missing = await validateFunction(functionPath);
    if (missing.length > 0) {
      throw new Error(`Missing required files: ${missing.join(', ')}`);
    }

    // Install dependencies
    log(`📦 Installing dependencies...`, 'blue');
    await execAsync('npm install', { cwd: functionPath });

    // Store deployment metadata
    const metadata = {
      source: 'git',
      gitUrl,
      branch,
      commit: commitHash,
      deployedAt: new Date().toISOString(),
      deployedBy: process.env.USER || 'unknown'
    };

    await fs.writeFile(
      path.join(functionPath, '.deployment.json'),
      JSON.stringify(metadata, null, 2)
    );

    // Trigger reload
    await reloadFunction(functionName);
  };

  // Define the validation function
  const validationFunction = async () => {
    return await validateFunctionDeployment(functionPath, functionName);
  };

  // Execute safe deployment
  const result = await safeDeploy(functionName, deploymentFunction, validationFunction);

  if (result.success) {
    log(`✅ Successfully deployed function: ${functionName}`, 'green');
  } else {
    log(`❌ Deployment failed and was rolled back: ${result.error}`, 'red');
    log(`🚨 ALERT: Function ${functionName} deployment failed due to test failures!`, 'red');
    log(`📦 Backup available for manual recovery if needed.`, 'yellow');
  }

  if (!result.success) {
    throw new Error(result.error);
  }
}

async function deployFromPullRequest(gitUrl, functionName, prNumber) {
  log(`🔄 Deploying function "${functionName}" from Pull Request #${prNumber}`, 'blue');

  // Check Git credentials before attempting to clone
  const hasCredentials = await checkGitCredentials(gitUrl);
  if (!hasCredentials) {
    log(`💡 Tip: Use 'make deploy-host-git' to use your host Git credentials instead`, 'yellow');
    throw new Error('Git credentials required for this repository');
  }

  const functionPath = path.join(functionsDir, functionName);

  try {
    // Remove existing function if it exists
    try {
      await fs.rm(functionPath, { recursive: true, force: true });
      log(`🗑️  Removed existing function: ${functionName}`, 'yellow');
    } catch {
      // Function doesn't exist, that's fine
    }

    // Clone the repository
    log(`📥 Cloning repository...`, 'blue');
    await execAsync(`git clone ${gitUrl} ${functionPath}`);

    // Fetch the pull request
    log(`📥 Fetching pull request #${prNumber}...`, 'blue');
    await execAsync(`cd ${functionPath} && git fetch origin pull/${prNumber}/head:pr-${prNumber}`);

    // Checkout the pull request branch
    log(`🔍 Checking out pull request branch...`, 'blue');
    await execAsync(`cd ${functionPath} && git checkout pr-${prNumber}`);

    // Get current commit hash for metadata
    const { stdout: currentCommit } = await execAsync(`cd ${functionPath} && git rev-parse HEAD`);
    const commitHash = currentCommit.trim();

    // Get PR title for metadata
    let prTitle = `PR #${prNumber}`;
    try {
      const { stdout: prInfo } = await execAsync(`cd ${functionPath} && git log --oneline -1`);
      prTitle = prInfo.trim();
    } catch {
      // Ignore if we can't get PR title
    }

    // Validate function structure
    const missing = await validateFunction(functionPath);
    if (missing.length > 0) {
      throw new Error(`Missing required files: ${missing.join(', ')}`);
    }

    // Install dependencies
    log(`📦 Installing dependencies...`, 'blue');
    await execAsync('npm install', { cwd: functionPath });

    // Store deployment metadata
    const metadata = {
      source: 'pull-request',
      gitUrl,
      prNumber: parseInt(prNumber),
      prTitle,
      commit: commitHash,
      deployedAt: new Date().toISOString(),
      deployedBy: process.env.USER || 'unknown'
    };

    await fs.writeFile(
      path.join(functionPath, '.deployment.json'),
      JSON.stringify(metadata, null, 2)
    );

    log(`✅ Successfully deployed function: ${functionName} from PR #${prNumber}`, 'green');

    // Trigger reload
    await reloadFunction(functionName);

  } catch (error) {
    log(`❌ Failed to deploy function: ${error.message}`, 'red');

    // Clean up on failure
    try {
      await fs.rm(functionPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    throw error;
  }
}

async function deployFromLocal(localPath, functionName) {
  log(`🔄 Deploying function "${functionName}" from local: ${localPath}`, 'blue');

  const functionPath = path.join(functionsDir, functionName);
  const absoluteLocalPath = path.resolve(localPath);

  // Define the deployment function
  const deploymentFunction = async () => {
    // Validate source exists
    await fs.access(absoluteLocalPath);

    // Validate function structure
    const missing = await validateFunction(absoluteLocalPath);
    if (missing.length > 0) {
      throw new Error(`Missing required files in source: ${missing.join(', ')}`);
    }

    // Remove existing function if it exists
    try {
      await fs.rm(functionPath, { recursive: true, force: true });
      log(`🗑️  Removed existing function: ${functionName}`, 'yellow');
    } catch {
      // Function doesn't exist, that's fine
    }

    // Copy files
    log(`📁 Copying files...`, 'blue');
    await execAsync(`cp -r "${absoluteLocalPath}" "${functionPath}"`);

    // Install dependencies
    log(`📦 Installing dependencies...`, 'blue');
    await execAsync('npm install', { cwd: functionPath });

    // Store deployment metadata
    const metadata = {
      source: 'local',
      localPath: absoluteLocalPath,
      deployedAt: new Date().toISOString(),
      deployedBy: process.env.USER || 'unknown'
    };

    await fs.writeFile(
      path.join(functionPath, '.deployment.json'),
      JSON.stringify(metadata, null, 2)
    );

    // Trigger reload
    await reloadFunction(functionName);
  };

  // Define the validation function
  const validationFunction = async () => {
    return await validateFunctionDeployment(functionPath, functionName);
  };

  // Execute safe deployment
  const result = await safeDeploy(functionName, deploymentFunction, validationFunction);

  if (result.success) {
    log(`✅ Successfully deployed function: ${functionName}`, 'green');
  } else {
    log(`❌ Deployment failed: ${result.error}`, 'red');
    throw new Error(result.error);
  }
}

async function updateFunction(functionName, options = {}) {
  log(`🔄 Updating function: ${functionName}`, 'blue');

  const functionPath = path.join(functionsDir, functionName);
  const metadataPath = path.join(functionPath, '.deployment.json');

  try {
    // Check if function exists
    await fs.access(functionPath);

    // Read deployment metadata
    const metadataContent = await fs.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(metadataContent);

    if (metadata.source === 'git' || metadata.source === 'pull-request') {
      // Update from Git
      const { gitUrl, branch = 'main' } = metadata;
      
      // Use provided branch/commit or fall back to original
      const targetBranch = options.branch || branch;
      const targetCommit = options.commit || null;
      
      if (targetCommit) {
        log(`📌 Updating to specific commit: ${targetCommit}`, 'yellow');
      } else if (options.branch && options.branch !== branch) {
        log(`🌿 Switching from branch ${branch} to ${targetBranch}`, 'yellow');
      }
      
      await deployFromGit(gitUrl, functionName, targetBranch, targetCommit);
    } else if (metadata.source === 'local') {
      log(`⚠️  Cannot auto-update local function. Use --local to redeploy.`, 'yellow');
    } else {
      throw new Error('Unknown deployment source');
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

    // Trigger reload to unregister routes
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

      // Read route config
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

      if (metadata.localPath) {
        log(`   Local Path: ${metadata.localPath}`, 'blue');
      }
    }

  } catch (error) {
    log(`❌ Failed to list functions: ${error.message}`, 'red');
    throw error;
  }
}

async function reloadFunction(functionName = null) {
  try {
    const reloadUrl = 'http://localhost:3000/api/reload';
    const body = functionName ? JSON.stringify({ functionName }) : '{}';

    const { stdout } = await execAsync(`curl -s -X POST -H "Content-Type: application/json" -d '${body}' ${reloadUrl}`);

    const response = JSON.parse(stdout);
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
    // Ensure functions directory exists
    await fs.mkdir(functionsDir, { recursive: true });

    if (options.list) {
      await listFunctions();
    } else if (options.remove) {
      await removeFunction(options.remove);
    } else if (options.update) {
      const updateOptions = {};
      if (options.branch) updateOptions.branch = options.branch;
      if (options.commit) updateOptions.commit = options.commit;
      await updateFunction(options.update, updateOptions);
    } else if (options.git) {
      if (!options.name) {
        throw new Error('Function name is required when deploying from Git');
      }
      await deployFromGit(options.git, options.name, options.branch, options.commit);
    } else if (options.pr) {
      if (!options.name || !options.prNumber) {
        throw new Error('Function name and pull request number are required when deploying from a pull request');
      }
      await deployFromPullRequest(options.pr, options.name, options.prNumber);
    } else if (options.local) {
      if (!options.name) {
        throw new Error('Function name is required when deploying from local');
      }
      await deployFromLocal(options.local, options.name);
    } else {
      log('❌ Invalid options. Use --help for usage information.', 'red');
      process.exit(1);
    }

  } catch (error) {
    log(`\n❌ Deployment failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run the deployment script
main();
