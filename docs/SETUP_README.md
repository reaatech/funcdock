# 🚀 FuncDock — Setup Guide

Welcome to FuncDock! This guide will help you get up and running in minutes.

## Index
- [Introduction](#introduction)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [Using Make](#using-make)
  - [Using npm](#using-npm)
  - [Using Docker](#using-docker)
- [Environment Setup](#environment-setup)
- [First Run](#first-run)
- [Troubleshooting](TROUBLESHOOTING_README.md)

---

## Introduction
FuncDock is a serverless platform for Node.js functions, designed for speed, security, and developer happiness.

## Prerequisites
- Node.js 22+
- Docker (optional, for containerized deployment)
- `jq` (for JSON processing in scripts): `brew install jq` (macOS) or `apt-get install jq` (Ubuntu)
- **Redis server**: Available on `localhost:6379` inside the host container for all functions.

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

## Environment Setup
- Copy `.env.example` to `.env` and adjust as needed.
- Review function-specific `.env` files in each function directory.

## First Run
- Visit [http://localhost:3000/api/status](http://localhost:3000/api/status) to check platform status.
- Access the dashboard at [http://localhost:3000/dashboard/](http://localhost:3000/dashboard/)

For more help, see [TROUBLESHOOTING_README.md](TROUBLESHOOTING_README.md). 