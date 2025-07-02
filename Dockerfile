FROM node:22-slim

# Install git for cloning function repositories, Redis server, and Redis client tools
RUN apt-get update && apt-get install -y \
    git \
    curl \
    redis-server \
    redis-tools \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Create necessary directories first
RUN mkdir -p functions logs

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Configure Redis
RUN mkdir -p /var/lib/redis
RUN chown -R redis:redis /var/lib/redis

# Create non-root user for security
RUN groupadd -r serverless && useradd -r -g serverless serverless

# Set proper ownership and permissions for the app directory
# This is the critical fix - ensure serverless user owns everything
RUN chown -R serverless:serverless /app
RUN chmod -R 755 /app
RUN chmod -R 777 /app/functions  # Ensure functions directory is writable
RUN chmod -R 777 /app/logs       # Ensure logs directory is writable

# Create and set permissions for npm cache directory
RUN mkdir -p /home/serverless/.npm
RUN chown -R serverless:serverless /home/serverless

# Switch to serverless user
USER serverless

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info

# Start Redis and the application
CMD ["sh", "-c", "redis-server --daemonize yes && node server.js"]
