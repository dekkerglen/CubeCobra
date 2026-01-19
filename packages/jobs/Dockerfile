# Build stage
FROM node:22 AS builder

WORKDIR /app

# Copy package files for all workspaces
COPY package*.json ./
COPY packages/jobs/package*.json ./packages/jobs/
COPY packages/server/package*.json ./packages/server/
COPY packages/utils/package*.json ./packages/utils/
COPY packages/client/package*.json ./packages/client/

# Install all dependencies (including dev dependencies for building)
RUN npm install --workspaces --include-workspace-root

# Copy source code
COPY packages/jobs ./packages/jobs
COPY packages/server ./packages/server
COPY packages/utils ./packages/utils

# Build the projects (server -> jobs)
RUN npm run build --workspace=packages/server
RUN npm run build --workspace=packages/jobs

# Production stage
FROM node:22-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/jobs/package*.json ./packages/jobs/
COPY packages/server/package*.json ./packages/server/
COPY packages/utils/package*.json ./packages/utils/

# Install only production dependencies
RUN npm install --workspaces --omit=dev --include-workspace-root

# Copy built artifacts from builder stage
COPY --from=builder /app/packages/jobs/dist ./packages/jobs/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/utils/dist ./packages/utils/dist

# Copy any additional runtime files needed
COPY --from=builder /app/packages/jobs/tsconfig.json ./packages/jobs/
COPY --from=builder /app/packages/server/tsconfig.json ./packages/server/
COPY --from=builder /app/packages/utils/tsconfig.json ./packages/utils/

# Set working directory to jobs package
WORKDIR /app/packages/jobs

# Default command (can be overridden)
CMD ["npm", "run", "update-all"]
