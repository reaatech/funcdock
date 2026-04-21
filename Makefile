# FuncDock Platform Makefile
#
# DEPRECATED: Use the `funcdock` CLI instead.
#   npm install -g funcdock    # or use npx funcdock
#   funcdock --help            # See all commands
#
# This Makefile is kept for backward compatibility.

.PHONY: help setup install start dev stop logs status deploy clean test build push

# Default target
help: ## Show this help message
	@echo "⚠️  Makefile is deprecated. Use: funcdock --help"
	@echo ""
	@echo "FuncDock Platform"
	@echo "================"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Setup and Installation
setup: ## Setup the platform (create directories, files)
	@echo "🚀 Setting up the platform..."
	@node scripts/setup.js

install: ## Install dependencies
	@echo "📦 Installing dependencies..."
	@npm install

# Development
start: ## Start the platform in production mode
	@echo "🚀 Starting platform..."
	@npm start

dev: ## Start the platform in development mode with hot reload
	@echo "🔧 Starting development server..."
	@npm run dev

stop: ## Stop all Docker containers
	@echo "🛑 Stopping containers..."
	@docker-compose down

# Monitoring
logs: ## Show application logs
	@echo "📄 Showing application logs..."
	@npm run logs

error-logs: ## Show error logs only
	@echo "🚨 Showing error logs..."
	@npm run error-logs

status: ## Check platform status
	@echo "📊 Checking platform status..."
	@npm run status

# Function Management
deploy-help: ## Show deployment help
	@echo "📦 Function Deployment Commands:"
	@echo "  make deploy-git REPO=<repo-url> NAME=<function-name> [BRANCH=<branch>]"
	@echo "  make deploy-local PATH=<local-path> NAME=<function-name>"
	@echo "  make deploy-host-git REPO=<repo-url> NAME=<function-name> [BRANCH=<branch>]"
	@echo "  make list-functions"
	@echo "  make update-function NAME=<function-name>"
	@echo "  make remove-function NAME=<function-name>"

deploy-git: ## Deploy function from Git repository
	@if [ -z "$(REPO)" ] || [ -z "$(NAME)" ]; then \
		echo "❌ Usage: make deploy-git REPO=<repo-url> NAME=<function-name> [BRANCH=<branch>]"; \
		exit 1; \
	fi
	@echo "📦 Deploying $(NAME) from $(REPO)..."
	@node scripts/deploy.js --git "$(REPO)" --name "$(NAME)" $(if $(BRANCH),--branch "$(BRANCH)")

deploy-local: ## Deploy function from local directory
	@if [ -z "$(PATH)" ] || [ -z "$(NAME)" ]; then \
		echo "❌ Usage: make deploy-local PATH=<local-path> NAME=<function-name>"; \
		exit 1; \
	fi
	@echo "📦 Deploying $(NAME) from $(PATH)..."
	@node scripts/deploy.js --local "$(PATH)" --name "$(NAME)"

deploy-host-git: ## Deploy function from Git using host credentials
	@if [ -z "$(REPO)" ] || [ -z "$(NAME)" ]; then \
		echo "❌ Usage: make deploy-host-git REPO=<repo-url> NAME=<function-name> [BRANCH=<branch>]"; \
		exit 1; \
	fi
	@echo "🏠 Deploying $(NAME) from $(REPO) using host Git credentials..."
	@node scripts/deploy-from-host.js --git "$(REPO)" --name "$(NAME)" $(if $(BRANCH),--branch "$(BRANCH)")

list-functions: ## List all deployed functions
	@echo "📋 Listing functions..."
	@node scripts/deploy.js --list

update-function: ## Update a specific function
	@if [ -z "$(NAME)" ]; then \
		echo "❌ Usage: make update-function NAME=<function-name>"; \
		exit 1; \
	fi
	@echo "🔄 Updating function $(NAME)..."
	@node scripts/deploy.js --update "$(NAME)"

remove-function: ## Remove a specific function
	@if [ -z "$(NAME)" ]; then \
		echo "❌ Usage: make remove-function NAME=<function-name>"; \
		exit 1; \
	fi
	@echo "🗑️ Removing function $(NAME)..."
	@node scripts/deploy.js --remove "$(NAME)"

reload: ## Reload all functions
	@echo "🔄 Reloading all functions..."
	@npm run reload

# Docker Commands
build: ## Build Docker image
	@echo "🐳 Building Docker image..."
	@docker build -t funcdock .

run: ## Run in Docker container
	@echo "🐳 Running in Docker..."
	@docker run -p 3000:3000 -v $(PWD)/functions:/app/functions funcdock

docker-dev: ## Run development environment with Docker Compose
	@echo "🐳 Starting Docker development environment..."
	@docker-compose up --build

docker-prod: ## Run production environment with Docker Compose
	@echo "🐳 Starting Docker production environment..."
	@docker-compose --profile production up --build -d

docker-logs: ## Show Docker container logs
	@echo "📄 Showing Docker logs..."
	@docker-compose logs -f

# Testing
test: ## Run all tests with Jest
	@echo "🧪 Running all tests..."
	@npm test

test-watch: ## Run tests in watch mode
	@echo "👀 Running tests in watch mode..."
	@npm run test:watch

test-coverage: ## Run tests with coverage report
	@echo "📊 Running tests with coverage..."
	@npm run test:coverage

test-functions: ## Run tests for functions only
	@echo "🧪 Testing functions only..."
	@npm run test:functions

test-unit: ## Run unit tests only
	@echo "🧪 Running unit tests..."
	@npm run test:unit

test-integration: ## Run integration tests only
	@echo "🧪 Running integration tests..."
	@npm run test:integration

test-functions-integration: ## Test all deployed functions (integration tests)
	@echo "🧪 Testing all deployed functions..."
	@chmod +x scripts/test-functions.sh
	@./scripts/test-functions.sh

test-function-docker: ## Run Jest tests for a function in a Dockerized prod-like environment
	@echo "🧪 Running function tests in Docker..."
	@node scripts/test-function-in-docker.js --function=$(FUNCTION)$(if $(ROUTE), --route=$(ROUTE))

check-git: ## Check Git configuration and credentials
	@echo "🔍 Checking Git configuration..."
	@npm run check-git

# Maintenance
clean: ## Clean up logs and temporary files
	@echo "🧹 Cleaning up..."
	@rm -rf logs/*.log
	@rm -rf functions/*/node_modules
	@docker system prune -f

clean-all: ## Clean everything including Docker images
	@echo "🧹 Deep cleaning..."
	@make clean
	@docker-compose down --rmi all --volumes
	@docker system prune -af

# Health Checks
health: ## Check platform health
	@echo "🏥 Checking platform health..."
	@curl -f http://localhost:3000/health || echo "❌ Platform is not healthy"

ping: ## Ping the platform
	@echo "🏓 Pinging platform..."
	@curl -s http://localhost:3000/api/status | jq '.status' || echo "❌ Platform is not responding"

# Development Utilities
watch-logs: ## Watch logs in real-time
	@echo "👀 Watching logs..."
	@tail -f logs/app.log

create-function: ## Create a new function template
	@if [ -z "$(NAME)" ]; then \
		echo "❌ Usage: make create-function NAME=<function-name>"; \
		exit 1; \
	fi
	@echo "📁 Creating function template: $(NAME)..."
	@mkdir -p functions/$(NAME)
	@./scripts/create-function-template.sh $(NAME)

# Examples
example-deploy: ## Deploy example functions
	@echo "📦 Deploying example functions..."
	@echo "The hello-world and webhook-handler functions are already included!"
	@echo "Try: curl http://localhost:3000/hello-world/"

example-test: ## Test example functions
	@echo "🧪 Testing example functions..."
	@echo "Testing hello-world function..."
	@curl -s http://localhost:3000/hello-world/ | jq
	@echo "\nTesting webhook handler..."
	@curl -s http://localhost:3000/webhook-handler/ | jq

# Quick start for new users
quickstart: setup install dev ## Complete quickstart: setup, install, and start development server

# Production deployment
production: build docker-prod ## Build and deploy to production
