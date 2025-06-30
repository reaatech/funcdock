#!/usr/bin/env node

/**
 * Setup Script for Single-Container Serverless Platform
 * Initializes the platform and creates necessary directories and files
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

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

async function createDirectory(dirPath, description) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    log(`✅ Created ${description}: ${dirPath}`, 'green');
  } catch (error) {
    if (error.code === 'EEXIST') {
      log(`ℹ️  ${description} already exists: ${dirPath}`, 'blue');
    } else {
      log(`❌ Failed to create ${description}: ${error.message}`, 'red');
      throw error;
    }
  }
}

async function createFile(filePath, content, description) {
  try {
    await fs.writeFile(filePath, content);
    log(`✅ Created ${description}: ${filePath}`, 'green');
  } catch (error) {
    log(`❌ Failed to create ${description}: ${error.message}`, 'red');
    throw error;
  }
}

async function checkFileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function setup() {
  log('🚀 Setting up FuncDock Platform...', 'blue');

  try {
    // Create necessary directories
    const directories = [
      { path: path.join(projectRoot, 'functions'), desc: 'Functions directory' },
      { path: path.join(projectRoot, 'logs'), desc: 'Logs directory' },
      { path: path.join(projectRoot, 'utils'), desc: 'Utils directory' },
      { path: path.join(projectRoot, 'scripts'), desc: 'Scripts directory' },
      { path: path.join(projectRoot, 'ssl'), desc: 'SSL certificates directory' }
    ];

    for (const dir of directories) {
      await createDirectory(dir.path, dir.desc);
    }

    // Create .env file if it doesn't exist
    const envPath = path.join(projectRoot, '.env');
    if (!(await checkFileExists(envPath))) {
      const envContent = `# FuncDock Platform Configuration

# Server Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Webhook Secrets (optional)
# GITHUB_WEBHOOK_SECRET=your_github_webhook_secret
# STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Alerting Configuration (optional)
# SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

# SSL Configuration (for production)
# SSL_CERT_PATH=/app/ssl/cert.pem
# SSL_KEY_PATH=/app/ssl/key.pem
`;
      await createFile(envPath, envContent, '.env configuration file');
    } else {
      log('ℹ️  .env file already exists', 'blue');
    }

    // Create .gitignore if it doesn't exist
    const gitignorePath = path.join(projectRoot, '.gitignore');
    if (!(await checkFileExists(gitignorePath))) {
      const gitignoreContent = `# Dependencies
node_modules/
*/node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs/
*.log

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# NYC test coverage
.nyc_output/

# Dependency directories
jspm_packages/

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Microbundle cache
.rpt2_cache/
.rts2_cache_cjs/
.rts2_cache_es/
.rts2_cache_umd/

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# parcel-bundler cache (https://parceljs.org/)
.cache
.parcel-cache

# SSL certificates
ssl/*.pem
ssl/*.key
ssl/*.crt

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# Docker
.dockerignore
`;
      await createFile(gitignorePath, gitignoreContent, '.gitignore file');
    } else {
      log('ℹ️  .gitignore file already exists', 'blue');
    }

    // Note: Caddy is used as the reverse proxy (see Caddyfile and docker-compose.yml)
    // No nginx.conf needed - Caddy provides automatic HTTPS, security headers, and simpler configuration

    // Create README.md if it doesn't exist
    const readmePath = path.join(projectRoot, 'README.md');
    if (!(await checkFileExists(readmePath))) {
      const readmeContent = `# FuncDock

A lightweight serverless platform that runs multiple Node.js functions in a single Docker container with hot-reload capabilities.

## Features

- 🐳 Single Docker container for all functions
- 🔄 Hot reload with filesystem watching
- 📁 Per-function Git repositories
- 🛣️ Custom routing per function
- 📊 Built-in monitoring and logging
- 🚨 Alert system with Slack integration
- 🔒 Route conflict prevention
- 🌐 Full HTTP method support

## Quick Start

1. **Setup the platform:**
   \`\`\`bash
   npm install
   npm run setup
   \`\`\`

2. **Start development server:**
   \`\`\`bash
   npm run dev
   \`\`\`

3. **Or use Docker:**
   \`\`\`bash
   docker-compose up
   \`\`\`

## Function Development

Create a new function in the \`functions/\` directory:

\`\`\`
functions/
  my-function/
    handler.js
    package.json
    route.config.json
\`\`\`

### Example Function Structure

**handler.js:**
\`\`\`javascript
export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ message: 'Hello World!' });
  }
  return res.status(405).json({ error: 'Method Not Allowed' });
}
\`\`\`

**route.config.json:**
\`\`\`json
{
  "base": "/my-function",
  "routes": [
    { "path": "/", "methods": ["GET", "POST"] },
    { "path": "/test", "methods": ["GET"] }
  ]
}
\`\`\`

## API Endpoints

- \`GET /api/status\` - Platform status and loaded functions
- \`POST /api/reload\` - Reload all or specific functions
- \`GET /health\` - Health check

## Management Commands

- \`npm run status\` - Check platform status
- \`npm run reload\` - Reload all functions
- \`npm run logs\` - View application logs
- \`npm run error-logs\` - View error logs

## Environment Variables

See \`.env\` file for configuration options.

## Production Deployment

1. Build and run with Docker:
   \`\`\`bash
   docker build -t funcdock .
   docker run -p 3000:3000 -v ./functions:/app/functions funcdock
   \`\`\`

2. Or use Docker Compose with nginx:
   \`\`\`bash
   docker-compose --profile production up
   \`\`\`

## License

MIT
`;
      await createFile(readmePath, readmeContent, 'README.md file');
    } else {
      log('ℹ️  README.md file already exists', 'blue');
    }

    log('\n🎉 Setup completed successfully!', 'green');
    log('\nNext steps:', 'blue');
    log('1. Review and update the .env file with your configuration', 'yellow');
    log('2. Install dependencies: npm install', 'yellow');
    log('3. Start the development server: npm run dev', 'yellow');
    log('4. Visit http://localhost:3000/api/status to check the platform', 'yellow');
    log('5. Test the sample functions:', 'yellow');
    log('   - GET http://localhost:3000/hello-world/', 'yellow');
    log('   - POST http://localhost:3000/webhook-handler/github', 'yellow');

  } catch (error) {
    log(`\n❌ Setup failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run setup
setup();
