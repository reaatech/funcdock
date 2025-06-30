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
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(__dirname);
const functionsDir = path.join(projectRoot, 'functions');

// Create a temporary directory for Git operations
const tempDir = path.join(projectRoot, '.temp-deploy');

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
  log('\n🏠 Host-based FuncDock Function Deployment Tool', 'blue');
  log('\nThis tool handles Git operations on the host and syncs to the container.', 'yellow');
  log('\nUsage:', 'yellow');
  log('  npm run deploy-host -- --git <repo-url> --name <function-name>', 'blue');
  log('  npm run deploy-host -- --pr <repo-url> --name <function-name> --pr-number <number>', 'blue');
  log('  npm run deploy-host -- --update <function-name>', 'blue');
  log('  npm run deploy-host -- --update <function-name> --branch <branch>', 'blue');
  log('  npm run deploy-host -- --update <function-name> --commit <commit-hash>', 'blue');
  log('  npm run deploy-host -- --list', 'blue');
  log('  npm run deploy-host -- --remove <function-name>', 'blue');

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
  log('  npm run deploy-host -- --git https://github.com/user/my-function.git --name my-function', 'blue');
  log('  npm run deploy-host -- --pr https://github.com/user/my-function.git --name my-function --pr-number 123', 'blue');
  log('  npm run deploy-host -- --update my-function', 'blue');
  log('  npm run deploy-host -- --update my-function --branch feature/new-feature', 'blue');
  log('  npm run deploy-host -- --update my-function --commit abc123def', 'blue');
  log('  npm run deploy-host -- --remove old-function', 'blue');
  
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

  const functionPath = path.join(functionsDir, functionName);
  const tempFunctionPath = path.join(tempDir, functionName);

  try {
    await ensureTempDir();

    // Remove existing temp function if it exists
    try {
      await fs.rm(tempFunctionPath, { recursive: true, force: true });
    } catch {
      // Doesn't exist, that's fine
    }

    // Clone the repository to temp directory (uses host credentials)
    log(`📥 Cloning repository to temp directory...`, 'blue');
    await execAsync(`git clone --branch ${branch} ${gitUrl} ${tempFunctionPath}`);

    // Checkout specific commit if provided
    if (commit) {
      log(`🔍 Checking out commit: ${commit}`, 'blue');
      await execAsync(`cd ${tempFunctionPath} && git checkout ${commit}`);
    }

    // Get current commit hash for metadata
    const { stdout: currentCommit } = await execAsync(`cd ${tempFunctionPath} && git rev-parse HEAD`);
    const commitHash = currentCommit.trim();

    // Validate function structure
    const missing = await validateFunction(tempFunctionPath);
    if (missing.length > 0) {
      throw new Error(`Missing required files: ${missing.join(', ')}`);
    }

    // Remove existing function if it exists
    try {
      await fs.rm(functionPath, { recursive: true, force: true });
      log(`🗑️  Removed existing function: ${functionName}`, 'yellow');
    } catch {
      // Function doesn't exist, that's fine
    }

    // Copy from temp to functions directory (this syncs to container)
    log(`📁 Copying function to container...`, 'blue');
    await execAsync(`cp -r "${tempFunctionPath}" "${functionPath}"`);

    // Store deployment metadata
    const metadata = {
      source: 'git',
      gitUrl,
      branch,
      commit: commitHash,
      deployedAt: new Date().toISOString(),
      deployedBy: process.env.USER || 'unknown',
      deploymentMethod: 'host-based'
    };

    await fs.writeFile(
      path.join(functionPath, '.deployment.json'),
      JSON.stringify(metadata, null, 2)
    );

    log(`✅ Successfully deployed function: ${functionName}`, 'green');
    log(`🔄 Function will be automatically loaded by the container`, 'blue');

    // Trigger reload via API
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
  } finally {
    await cleanupTempDir();
  }
}

async function deployFromPullRequest(gitUrl, functionName, prNumber) {
  log(`🔄 Deploying function "${functionName}" from Pull Request #${prNumber}`, 'blue');
  log(`📋 Using host Git credentials for authentication`, 'yellow');

  const functionPath = path.join(functionsDir, functionName);
  const tempFunctionPath = path.join(tempDir, functionName);

  try {
    await ensureTempDir();

    // Remove existing temp function if it exists
    try {
      await fs.rm(tempFunctionPath, { recursive: true, force: true });
    } catch {
      // Doesn't exist, that's fine
    }

    // Clone the repository to temp directory
    log(`📥 Cloning repository to temp directory...`, 'blue');
    await execAsync(`git clone ${gitUrl} ${tempFunctionPath}`);

    // Fetch the pull request
    log(`📥 Fetching pull request #${prNumber}...`, 'blue');
    await execAsync(`cd ${tempFunctionPath} && git fetch origin pull/${prNumber}/head:pr-${prNumber}`);

    // Checkout the pull request branch
    log(`🔍 Checking out pull request branch...`, 'blue');
    await execAsync(`cd ${tempFunctionPath} && git checkout pr-${prNumber}`);

    // Get current commit hash for metadata
    const { stdout: currentCommit } = await execAsync(`cd ${tempFunctionPath} && git rev-parse HEAD`);
    const commitHash = currentCommit.trim();

    // Get PR title for metadata
    let prTitle = `PR #${prNumber}`;
    try {
      const { stdout: prInfo } = await execAsync(`cd ${tempFunctionPath} && git log --oneline -1`);
      prTitle = prInfo.trim();
    } catch {
      // Ignore if we can't get PR title
    }

    // Validate function structure
    const missing = await validateFunction(tempFunctionPath);
    if (missing.length > 0) {
      throw new Error(`Missing required files: ${missing.join(', ')}`);
    }

    // Remove existing function if it exists
    try {
      await fs.rm(functionPath, { recursive: true, force: true });
      log(`🗑️  Removed existing function: ${functionName}`, 'yellow');
    } catch {
      // Function doesn't exist, that's fine
    }

    // Copy from temp to functions directory (this syncs to container)
    log(`📁 Copying function to container...`, 'blue');
    await execAsync(`cp -r "${tempFunctionPath}" "${functionPath}"`);

    // Store deployment metadata
    const metadata = {
      source: 'pull-request',
      gitUrl,
      prNumber: parseInt(prNumber),
      prTitle,
      commit: commitHash,
      deployedAt: new Date().toISOString(),
      deployedBy: process.env.USER || 'unknown',
      deploymentMethod: 'host-based'
    };

    await fs.writeFile(
      path.join(functionPath, '.deployment.json'),
      JSON.stringify(metadata, null, 2)
    );

    log(`✅ Successfully deployed function: ${functionName} from PR #${prNumber}`, 'green');
    log(`🔄 Function will be automatically loaded by the container`, 'blue');

    // Trigger reload via API
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
  } finally {
    await cleanupTempDir();
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