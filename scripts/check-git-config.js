#!/usr/bin/env node

/**
 * Git Configuration Checker for FuncDock
 * Helps users verify their Git setup before deployment
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

async function checkGitConfig() {
  log('\n🔍 FuncDock Git Configuration Checker', 'blue');
  log('=====================================\n', 'blue');

  try {
    // Check if Git is installed
    log('1. Checking Git installation...', 'yellow');
    const { stdout: gitVersion } = await execAsync('git --version');
    log(`   ✅ Git installed: ${gitVersion.trim()}`, 'green');

    // Check Git user configuration
    log('\n2. Checking Git user configuration...', 'yellow');
    try {
      const { stdout: userName } = await execAsync('git config --global user.name');
      log(`   ✅ Username: ${userName.trim()}`, 'green');
    } catch {
      log('   ❌ Username not configured', 'red');
      log('   💡 Run: git config --global user.name "Your Name"', 'blue');
    }

    try {
      const { stdout: userEmail } = await execAsync('git config --global user.email');
      log(`   ✅ Email: ${userEmail.trim()}`, 'green');
    } catch {
      log('   ❌ Email not configured', 'red');
      log('   💡 Run: git config --global user.email "your.email@example.com"', 'blue');
    }

    // Check credential helper
    log('\n3. Checking credential helper...', 'yellow');
    try {
      const { stdout: credentialHelper } = await execAsync('git config --global credential.helper');
      log(`   ✅ Credential helper: ${credentialHelper.trim()}`, 'green');
    } catch {
      log('   ❌ No credential helper configured', 'red');
      log('   💡 Run: git config --global credential.helper store', 'blue');
    }

    // Check SSH keys
    log('\n4. Checking SSH keys...', 'yellow');
    try {
      const { stdout: sshKeys } = await execAsync('ls -la ~/.ssh/');
      if (sshKeys.includes('id_rsa') || sshKeys.includes('id_ed25519')) {
        log('   ✅ SSH keys found', 'green');
      } else {
        log('   ⚠️  No SSH keys found', 'yellow');
        log('   💡 Generate SSH key: ssh-keygen -t ed25519 -C "your.email@example.com"', 'blue');
      }
    } catch {
      log('   ❌ Could not check SSH keys', 'red');
    }

    // Test GitHub access
    log('\n5. Testing GitHub access...', 'yellow');
    try {
      await execAsync('git ls-remote --exit-code https://github.com/octocat/Hello-World.git', {
        timeout: 10000,
      });
      log('   ✅ HTTPS access to GitHub working', 'green');
    } catch (error) {
      if (error.code === 128) {
        log('   ❌ HTTPS access requires authentication', 'red');
        log('   💡 Configure credentials or use SSH', 'blue');
      } else {
        log('   ⚠️  Could not test HTTPS access', 'yellow');
      }
    }

    try {
      await execAsync('git ls-remote --exit-code git@github.com:octocat/Hello-World.git', {
        timeout: 10000,
      });
      log('   ✅ SSH access to GitHub working', 'green');
    } catch (error) {
      if (error.code === 128) {
        log('   ❌ SSH access requires key setup', 'red');
        log('   💡 Add SSH key to GitHub account', 'blue');
      } else {
        log('   ⚠️  Could not test SSH access', 'yellow');
      }
    }

    // Recommendations
    log('\n📋 Recommendations:', 'blue');
    log('• For private repositories, use: make deploy-host-git', 'green');
    log('• For public repositories, either method works', 'green');
    log('• Use SSH keys for the most secure authentication', 'green');
    log('• Test your setup with: git ls-remote <your-repo-url>', 'green');
  } catch (error) {
    log(`❌ Error checking Git configuration: ${error.message}`, 'red');
  }
}

// Run the check
checkGitConfig().catch(console.error);
