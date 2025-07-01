# SETUP

## Prerequisites
- Node.js 22+ 
- Docker (optional, for containerized deployment)
- `jq` (for JSON processing in scripts): `brew install jq` (macOS) or `apt-get install jq` (Ubuntu)
- **Redis server**: A Redis server is automatically available on `localhost:6379` inside the host container. All functions can use this for caching, queues, and other Redis-backed features.

## Installation

### Using Make (Recommended)
```bash
# Complete setup and start
make quickstart

# Or step by step
make setup
make install  
make dev
```

### Using npm
```bash
# Setup the platform
npm install
npm run setup

# Start development server
npm run dev
```

### Using Docker
```bash
# Development environment
docker-compose up

# Production environment  
docker-compose --profile production up
``` 