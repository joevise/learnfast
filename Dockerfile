FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY server/package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy server files
COPY server/src ./src
COPY server/.env.example .env

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start command
CMD ["node", "src/index.js"]
