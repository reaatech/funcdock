#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse CLI args
const args = process.argv.slice(2);
let functionPath = null;
let route = null;

for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--function=')) {
    functionPath = args[i].split('=')[1];
  } else if (args[i].startsWith('--route=')) {
    route = args[i].split('=')[1];
  }
}

if (!functionPath) {
  console.error('Usage: node scripts/test-function-in-docker.js --function=./functions/your-func [--route=/route]');
  process.exit(1);
}

const absFunctionPath = path.resolve(functionPath);
if (!fs.existsSync(absFunctionPath)) {
  console.error(`Function directory not found: ${absFunctionPath}`);
  process.exit(1);
}

const imageName = 'funcdock-test-env';
const containerName = `funcdock-test-${Date.now()}`;

// Build the Docker image if needed
console.log('Building test Docker image (if needed)...');
try {
  execSync(`docker build -f Dockerfile.test -t ${imageName} .`, { stdio: 'inherit' });
} catch (err) {
  console.error('Failed to build Docker image.');
  process.exit(1);
}

// Determine the Jest command
let jestCmd = 'npx jest';
if (route) {
  // Try to find a test file matching the route (e.g., greet.test.js for /greet)
  const routeName = route.replace(/^\//, '').replace(/\//g, '-');
  const testFile = fs.readdirSync(absFunctionPath).find(f => f === `${routeName}.test.js`);
  if (testFile) {
    jestCmd += ` ${testFile}`;
  } else {
    console.warn(`No test file found for route: ${route} (expected: ${routeName}.test.js)`);
  }
}

// Run the container and execute Jest
console.log(`\nRunning tests in Docker container for function: ${functionPath}`);
const dockerArgs = [
  'run', '--rm',
  '-v', `${absFunctionPath}:/app/function`,
  '-w', '/app/function',
  imageName,
  'sh', '-c', `redis-server --daemonize yes && ${jestCmd}`
];

const child = spawn('docker', dockerArgs, { stdio: 'inherit' });
child.on('exit', code => {
  process.exit(code);
}); 