# Build stage
FROM node:22 AS builder

WORKDIR /app

# Copy package files for all workspaces
COPY package*.json ./
COPY packages/jobs/package*.json ./packages/jobs/
COPY packages/server/package*.json ./packages/server/
COPY packages/utils/package*.json ./packages/utils/
COPY packages/client/package*.json ./packages/client/
COPY packages/recommenderService/package*.json ./packages/recommenderService/

# Install all dependencies (including dev dependencies for building)
RUN npm install --workspaces --include-workspace-root

# Copy source code
COPY packages/jobs ./packages/jobs
COPY packages/server ./packages/server
COPY packages/utils ./packages/utils
COPY packages/client ./packages/client
COPY packages/recommenderService ./packages/recommenderService

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
COPY packages/recommenderService/package*.json ./packages/recommenderService/

# Install only production dependencies
RUN npm install --workspaces --omit=dev --include-workspace-root

# Copy built artifacts from builder stage
COPY --from=builder /app/packages/jobs/dist ./packages/jobs/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist

# Copy utils source (not built, pure TypeScript)
COPY --from=builder /app/packages/utils/src ./packages/utils/src

# Copy recommenderService source (needed for ML utilities)
COPY --from=builder /app/packages/recommenderService/src ./packages/recommenderService/src

# Copy any additional runtime files needed
COPY --from=builder /app/packages/jobs/tsconfig.json ./packages/jobs/
COPY --from=builder /app/packages/server/tsconfig.json ./packages/server/

# Set working directory to jobs package
WORKDIR /app/packages/jobs

# Default command (can be overridden)
CMD ["npm", "run", "update-all"]
