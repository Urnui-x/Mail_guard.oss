# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/core/package*.json ./packages/core/
COPY packages/smtp/package*.json ./packages/smtp/
COPY apps/api/package*.json ./apps/api/

# Install dependencies
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY packages/core ./packages/core
COPY packages/smtp ./packages/smtp
COPY apps/api ./apps/api

# Build
RUN npm run build --workspace=packages/core
RUN npm run build --workspace=packages/smtp
RUN npm run build --workspace=apps/api

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Set to production
ENV NODE_ENV=production

# Copy built files and dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/smtp/dist ./packages/smtp/dist
COPY --from=builder /app/packages/smtp/package.json ./packages/smtp/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/

# Expose port
EXPOSE 3000

# Start the service
CMD ["node", "apps/api/dist/index.js"]