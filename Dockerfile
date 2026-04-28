FROM node:25-slim

# Install git for cloning function repositories, Redis server, and Redis client tools
RUN apt-get update && apt-get install -y \
    git \
    curl \
    redis-server \
    redis-tools \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Create functions directory
RUN mkdir -p functions logs

# Configure Redis to bind to localhost only and use /app for data
RUN mkdir -p /app/redis && \
    echo "bind 127.0.0.1" > /etc/redis/redis.conf && \
    echo "dir /app/redis" >> /etc/redis/redis.conf && \
    echo "logfile /app/redis/redis.log" >> /etc/redis/redis.conf && \
    echo "pidfile /app/redis/redis.pid" >> /etc/redis/redis.conf

# Create non-root user for security
RUN groupadd -r serverless && useradd -r -g serverless serverless
RUN chown -R serverless:serverless /app
USER serverless

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV HUSKY=0

# Start Redis and the application
CMD ["sh", "-c", "redis-server --daemonize yes --port 6379 --bind 127.0.0.1 --requirepass ${REDIS_PASSWORD:-funcdock_internal} && node server.js"]
