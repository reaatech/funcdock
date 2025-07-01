#!/usr/bin/env node

/**
 * Deployment Backup and Rollback Utility for FuncDock
 * 
 * This utility handles backing up existing functions before deployment
 * and rolling back if tests fail or deployment fails.
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

// Backup directory for rollbacks
const backupDir = path.join(projectRoot, '.deployment-backups');

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

/**
 * Ensure backup directory exists
 */
async function ensureBackupDir() {
  try {
    await fs.mkdir(backupDir, { recursive: true });
  } catch (error) {
    log(`❌ Failed to create backup directory: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * Create a backup of an existing function
 * @param {string} functionName - Name of the function to backup
 * @returns {Promise<string>} - Backup path
 */
export async function createBackup(functionName) {
  const functionPath = path.join(functionsDir, functionName);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `${functionName}-${timestamp}`);

  try {
    // Check if function exists
    await fs.access(functionPath);
    
    await ensureBackupDir();
    
    log(`💾 Creating backup of function: ${functionName}`, 'blue');
    
    // Copy function to backup directory
    await execAsync(`cp -r "${functionPath}" "${backupPath}"`);
    
    // Store backup metadata
    const backupMetadata = {
      functionName,
      originalPath: functionPath,
      backupPath,
      timestamp: new Date().toISOString(),
      backupType: 'pre-deployment'
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

/**
 * Rollback a function to its backup
 * @param {string} functionName - Name of the function to rollback
 * @param {string} backupPath - Path to the backup
 * @returns {Promise<boolean>} - Success status
 */
export async function rollbackFunction(functionName, backupPath) {
  const functionPath = path.join(functionsDir, functionName);
  
  try {
    log(`🔄 Rolling back function: ${functionName}`, 'yellow');
    
    // Remove current function
    try {
      await fs.rm(functionPath, { recursive: true, force: true });
      log(`🗑️  Removed failed deployment: ${functionName}`, 'yellow');
    } catch (error) {
      // Function might not exist, that's fine
    }
    
    // Restore from backup
    await execAsync(`cp -r "${backupPath}" "${functionPath}"`);
    
    log(`✅ Successfully rolled back function: ${functionName}`, 'green');
    return true;
    
  } catch (error) {
    log(`❌ Failed to rollback function: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Clean up old backups (keep last 5 backups per function)
 * @param {string} functionName - Optional function name to clean up
 */
export async function cleanupOldBackups(functionName = null) {
  try {
    await ensureBackupDir();
    
    const files = await fs.readdir(backupDir);
    const backups = files.filter(file => {
      if (functionName) {
        return file.startsWith(`${functionName}-`);
      }
      return file.includes('-');
    });
    
    if (backups.length <= 5) {
      return; // Keep all backups if 5 or fewer
    }
    
    // Sort by timestamp (newest first)
    backups.sort().reverse();
    
    // Remove old backups (keep first 5)
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

/**
 * List available backups
 * @param {string} functionName - Optional function name to filter
 */
export async function listBackups(functionName = null) {
  try {
    await ensureBackupDir();
    
    const files = await fs.readdir(backupDir);
    const backups = files.filter(file => {
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
        
      } catch (error) {
        log(`\n📦 ${backup} (metadata unavailable)`, 'green');
      }
    }
    
  } catch (error) {
    log(`❌ Could not list backups: ${error.message}`, 'red');
  }
}

/**
 * Manual rollback to a specific backup
 * @param {string} backupName - Name of the backup to restore
 * @returns {Promise<boolean>} - Success status
 */
export async function manualRollback(backupName) {
  const backupPath = path.join(backupDir, backupName);
  
  try {
    // Check if backup exists
    await fs.access(backupPath);
    
    // Read backup metadata
    const metadataPath = path.join(backupPath, '.backup-metadata.json');
    const metadataContent = await fs.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(metadataContent);
    
    log(`🔄 Manual rollback requested for: ${metadata.functionName}`, 'yellow');
    log(`📦 Using backup: ${backupName}`, 'blue');
    
    return await rollbackFunction(metadata.functionName, backupPath);
    
  } catch (error) {
    log(`❌ Backup not found or invalid: ${backupName}`, 'red');
    return false;
  }
}

/**
 * Deployment wrapper with backup and rollback
 * @param {string} functionName - Name of the function
 * @param {Function} deploymentFn - Deployment function to execute
 * @param {Function} validationFn - Validation function to run after deployment
 * @returns {Promise<{success: boolean, backupPath: string, error: string}>}
 */
export async function safeDeploy(functionName, deploymentFn, validationFn = null) {
  let backupPath = null;
  
  try {
    // Create backup before deployment
    backupPath = await createBackup(functionName);
    
    // Execute deployment
    log(`🚀 Starting deployment for: ${functionName}`, 'blue');
    await deploymentFn();
    
    // Run validation (tests)
    let validationResult;
    try {
      validationResult = await validationFn();
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
    
    // Cleanup old backups on successful deployment
    await cleanupOldBackups(functionName);
    
    log(`✅ Deployment successful: ${functionName}`, 'green');
    return {
      success: true,
      backupPath,
      error: null
    };
    
  } catch (error) {
    log(`❌ Deployment failed: ${error.message}`, 'red');
    
    // Rollback if we have a backup
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
      error: error.message
    };
  }
}

// CLI interface for manual operations
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const target = process.argv[3];
  
  switch (command) {
    case 'list':
      listBackups(target);
      break;
      
    case 'rollback':
      if (!target) {
        log('Usage: node deployment-backup.js rollback <backup-name>', 'red');
        process.exit(1);
      }
      manualRollback(target).then(success => {
        process.exit(success ? 0 : 1);
      });
      break;
      
    case 'cleanup':
      cleanupOldBackups(target);
      break;
      
    default:
      log('Usage:', 'blue');
      log('  node deployment-backup.js list [function-name]', 'blue');
      log('  node deployment-backup.js rollback <backup-name>', 'blue');
      log('  node deployment-backup.js cleanup [function-name]', 'blue');
      process.exit(1);
  }
} 