#!/usr/bin/env node

/**
 * Test Runner Utility for FuncDock
 * 
 * This utility runs tests for functions and provides results for deployment validation.
 * Used by deployment scripts to ensure functions pass tests before deployment.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(__dirname);

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
 * Check if a function has test files
 * @param {string} functionPath - Path to the function directory
 * @returns {Promise<boolean>} - True if function has test files
 */
export async function hasTestFiles(functionPath) {
  try {
    const files = await fs.readdir(functionPath);
    return files.some(file => file.endsWith('.test.js') || file.endsWith('.spec.js') || file.endsWith('.test.mjs') || file.endsWith('.spec.mjs'));
  } catch (error) {
    return false;
  }
}

/**
 * Get all test files for a function
 * @param {string} functionPath - Path to the function directory
 * @returns {Promise<string[]>} - Array of test file paths
 */
export async function getTestFiles(functionPath) {
  try {
    const files = await fs.readdir(functionPath);
    return files
      .filter(file => file.endsWith('.test.js') || file.endsWith('.spec.js') || file.endsWith('.test.mjs') || file.endsWith('.spec.mjs'))
      .map(file => path.join(functionPath, file));
  } catch (error) {
    return [];
  }
}

/**
 * Run tests for a specific function
 * @param {string} functionPath - Path to the function directory
 * @param {string} functionName - Name of the function
 * @returns {Promise<{success: boolean, output: string, error: string, testCount: number, passed: number, failed: number}>}
 */
export async function runFunctionTests(functionPath, functionName) {
  const testFiles = await getTestFiles(functionPath);
  
  if (testFiles.length === 0) {
    return {
      success: true,
      output: 'No test files found',
      error: null,
      testCount: 0,
      passed: 0,
      failed: 0
    };
  }

  log(`🧪 Running tests for function: ${functionName}`, 'blue');
  log(`📁 Test files found: ${testFiles.length}`, 'blue');

  try {
    // Run Jest tests for this function
    const { stdout, stderr } = await execAsync(
      `npx jest --config jest.config.mjs --testPathPattern="${functionPath}" --verbose --json --silent`,
      { 
        cwd: projectRoot,
        timeout: 30000, // 30 second timeout
        env: { ...process.env, NODE_OPTIONS: '--experimental-vm-modules' }
      }
    );

    // Parse Jest JSON output
    let testResults;
    try {
      testResults = JSON.parse(stdout);
    } catch (parseError) {
      // If JSON parsing fails, try to extract test results from stdout
      return {
        success: false,
        output: stdout,
        error: stderr || 'Failed to parse test results',
        testCount: 0,
        passed: 0,
        failed: 1
      };
    }

    const testCount = testResults.numTotalTests || 0;
    const passed = testResults.numPassedTests || 0;
    const failed = testResults.numFailedTests || 0;
    const success = failed === 0 && testCount > 0;

    if (success) {
      log(`✅ Tests passed: ${passed}/${testCount}`, 'green');
    } else {
      log(`❌ Tests failed: ${failed}/${testCount}`, 'red');
      if (testResults.testResults) {
        testResults.testResults.forEach(result => {
          if (result.status === 'failed') {
            log(`   Failed: ${result.name}`, 'red');
            result.assertionResults?.forEach(assertion => {
              if (assertion.status === 'failed') {
                log(`     - ${assertion.title}: ${assertion.failureMessages?.[0] || 'Unknown error'}`, 'red');
              }
            });
          }
        });
      }
    }

    return {
      success,
      output: stdout,
      error: stderr,
      testCount,
      passed,
      failed
    };

  } catch (error) {
    log(`❌ Test execution failed: ${error.message}`, 'red');
    
    return {
      success: false,
      output: error.stdout || '',
      error: error.stderr || error.message,
      testCount: 0,
      passed: 0,
      failed: 1
    };
  }
}

/**
 * Validate function deployment by running tests
 * @param {string} functionPath - Path to the function directory
 * @param {string} functionName - Name of the function
 * @returns {Promise<{valid: boolean, message: string, testResults: object}>}
 */
export async function validateFunctionDeployment(functionPath, functionName) {
  const hasTests = await hasTestFiles(functionPath);
  
  if (!hasTests) {
    return {
      valid: true,
      message: 'No tests found - deployment allowed',
      testResults: null
    };
  }

  log(`🔍 Validating deployment for function: ${functionName}`, 'blue');
  
  const testResults = await runFunctionTests(functionPath, functionName);
  
  if (testResults.success) {
    return {
      valid: true,
      message: `All tests passed (${testResults.passed}/${testResults.testCount})`,
      testResults
    };
  } else {
    return {
      valid: false,
      message: `Tests failed (${testResults.failed}/${testResults.testCount}) - deployment blocked`,
      testResults
    };
  }
}

/**
 * Run tests for multiple functions
 * @param {Array<{path: string, name: string}>} functions - Array of function objects
 * @returns {Promise<Array<{functionName: string, valid: boolean, message: string, testResults: object}>>}
 */
export async function validateMultipleFunctions(functions) {
  const results = [];
  
  for (const func of functions) {
    const result = await validateFunctionDeployment(func.path, func.name);
    results.push({
      functionName: func.name,
      ...result
    });
  }
  
  return results;
}

// CLI interface for standalone test running
if (import.meta.url === `file://${process.argv[1]}`) {
  const functionName = process.argv[2];
  
  if (!functionName) {
    log('Usage: node test-runner.js <function-name>', 'red');
    process.exit(1);
  }
  
  const functionPath = path.join(projectRoot, 'functions', functionName);
  
  validateFunctionDeployment(functionPath, functionName)
    .then(result => {
      if (result.valid) {
        log(`✅ Validation passed: ${result.message}`, 'green');
        process.exit(0);
      } else {
        log(`❌ Validation failed: ${result.message}`, 'red');
        process.exit(1);
      }
    })
    .catch(error => {
      log(`❌ Validation error: ${error.message}`, 'red');
      process.exit(1);
    });
} 