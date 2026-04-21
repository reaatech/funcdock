#!/usr/bin/env node

/**
 * Deployment Backup and Rollback Utility for FuncDock
 *
 * This utility handles backing up existing functions before deployment
 * and rolling back if tests fail or deployment fails.
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(__dirname);
const functionsDir = path.join(projectRoot, 'functions');

const backupDir = path.join(projectRoot, '.deployment-backups');

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

function _spawnAsync(command, args, options = {}) {
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

async function ensureBackupDir() {
  try {
    await fs.mkdir(backupDir, { recursive: true });
  } catch (error) {
    log(`❌ Failed to create backup directory: ${error.message}`, 'red');
    throw error;
  }
}

export async function createBackup(functionName) {
  const functionPath = path.join(functionsDir, functionName);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `${functionName}-${timestamp}`);

  try {
    await fs.access(functionPath);

    await ensureBackupDir();

    log(`💾 Creating backup of function: ${functionName}`, 'blue');

    await fs.cp(functionPath, backupPath, { recursive: true, force: true });

    const backupMetadata = {
      functionName,
      originalPath: functionPath,
      backupPath,
      timestamp: new Date().toISOString(),
      backupType: 'pre-deployment',
    };

    await fs.writeFile(
      path.join(backupPath, '.backup-metadata.json'),
      JSON.stringify(backupMetadata, null, 2)
    );

    log(`✅ Backup created: ${backupPath}`, 'green');
    return backupPath;
  } catch (error) {
    if (error.code === 'ENOENT') {
      log(`ℹ️  No existing function to backup: ${functionName}`, 'yellow');
      return null;
    }
    log(`❌ Failed to create backup: ${error.message}`, 'red');
    throw error;
  }
}

export async function rollbackFunction(functionName, backupPath) {
  const functionPath = path.join(functionsDir, functionName);

  try {
    log(`🔄 Rolling back function: ${functionName}`, 'yellow');

    try {
      await fs.rm(functionPath, { recursive: true, force: true });
      log(`🗑️  Removed failed deployment: ${functionName}`, 'yellow');
    } catch {
      // Function might not exist, that's fine
    }

    await fs.cp(backupPath, functionPath, { recursive: true, force: true });

    log(`✅ Successfully rolled back function: ${functionName}`, 'green');
    return true;
  } catch (error) {
    log(`❌ Failed to rollback function: ${error.message}`, 'red');
    return false;
  }
}

export async function cleanupOldBackups(functionName = null) {
  try {
    await ensureBackupDir();

    const files = await fs.readdir(backupDir);
    const backups = files.filter((file) => {
      if (functionName) {
        return file.startsWith(`${functionName}-`);
      }
      return file.includes('-');
    });

    if (backups.length <= 5) {
      return;
    }

    backups.sort().reverse();

    const toRemove = backups.slice(5);

    for (const backup of toRemove) {
      const backupPath = path.join(backupDir, backup);
      try {
        await fs.rm(backupPath, { recursive: true, force: true });
        log(`🧹 Cleaned up old backup: ${backup}`, 'blue');
      } catch (error) {
        log(`⚠️  Could not remove backup ${backup}: ${error.message}`, 'yellow');
      }
    }
  } catch (error) {
    log(`⚠️  Could not cleanup backups: ${error.message}`, 'yellow');
  }
}

export async function listBackups(functionName = null) {
  try {
    await ensureBackupDir();

    const files = await fs.readdir(backupDir);
    const backups = files.filter((file) => {
      if (functionName) {
        return file.startsWith(`${functionName}-`);
      }
      return file.includes('-');
    });

    if (backups.length === 0) {
      log('No backups found', 'yellow');
      return;
    }

    log('📋 Available Backups:', 'blue');

    for (const backup of backups.sort().reverse()) {
      const backupPath = path.join(backupDir, backup);
      try {
        const metadataPath = path.join(backupPath, '.backup-metadata.json');
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataContent);

        log(`\n📦 ${backup}`, 'green');
        log(`   Function: ${metadata.functionName}`, 'blue');
        log(`   Created: ${new Date(metadata.timestamp).toLocaleString()}`, 'blue');
        log(`   Type: ${metadata.backupType}`, 'blue');
      } catch {
        log(`\n📦 ${backup} (metadata unavailable)`, 'green');
      }
    }
  } catch (error) {
    log(`❌ Could not list backups: ${error.message}`, 'red');
  }
}

export async function manualRollback(backupName) {
  const backupPath = path.join(backupDir, backupName);

  try {
    await fs.access(backupPath);

    const metadataPath = path.join(backupPath, '.backup-metadata.json');
    const metadataContent = await fs.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(metadataContent);

    log(`🔄 Manual rollback requested for: ${metadata.functionName}`, 'yellow');
    log(`📦 Using backup: ${backupName}`, 'blue');

    return await rollbackFunction(metadata.functionName, backupPath);
  } catch {
    log(`❌ Backup not found or invalid: ${backupName}`, 'red');
    return false;
  }
}

export async function safeDeploy(functionName, deploymentFn, validationFn = null) {
  let backupPath = null;

  try {
    backupPath = await createBackup(functionName);

    log(`🚀 Starting deployment for: ${functionName}`, 'blue');
    await deploymentFn();

    let validationResult;
    try {
      validationResult = validationFn ? await validationFn() : { valid: true };
    } catch (error) {
      log(`❌ Validation error: ${error.message}`, 'red');
      await rollbackFunction(functionName, backupPath);
      return { success: false, error: error.message };
    }

    if (validationResult && validationResult.valid === false) {
      log(`❌ Validation failed: ${validationResult.message || 'Tests failed'}`, 'red');
      await rollbackFunction(functionName, backupPath);
      return { success: false, error: validationResult.message || 'Tests failed' };
    }

    await cleanupOldBackups(functionName);

    log(`✅ Deployment successful: ${functionName}`, 'green');
    return {
      success: true,
      backupPath,
      error: null,
    };
  } catch (error) {
    log(`❌ Deployment failed: ${error.message}`, 'red');

    if (backupPath) {
      log(`🔄 Initiating rollback for: ${functionName}`, 'yellow');
      const rollbackSuccess = await rollbackFunction(functionName, backupPath);

      if (rollbackSuccess) {
        log(`✅ Rollback successful: ${functionName}`, 'green');
      } else {
        log(`❌ Rollback failed: ${functionName}`, 'red');
        log(`📦 Manual recovery required. Backup available at: ${backupPath}`, 'yellow');
      }
    }

    return {
      success: false,
      backupPath,
      error: error.message,
    };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const target = process.argv[3];

  switch (command) {
    case 'list':
      listBackups(target).catch((err) => {
        log(`Error: ${err.message}`, 'red');
        process.exit(1);
      });
      break;

    case 'rollback':
      if (!target) {
        log('Usage: node deployment-backup.js rollback <backup-name>', 'red');
        process.exit(1);
      }
      manualRollback(target)
        .then((success) => {
          process.exit(success ? 0 : 1);
        })
        .catch((err) => {
          log(`Error: ${err.message}`, 'red');
          process.exit(1);
        });
      break;

    case 'cleanup':
      cleanupOldBackups(target).catch((err) => {
        log(`Error: ${err.message}`, 'red');
        process.exit(1);
      });
      break;

    default:
      log('Usage:', 'blue');
      log('  node deployment-backup.js list [function-name]', 'blue');
      log('  node deployment-backup.js rollback <backup-name>', 'blue');
      log('  node deployment-backup.js cleanup [function-name]', 'blue');
      process.exit(1);
  }
}
