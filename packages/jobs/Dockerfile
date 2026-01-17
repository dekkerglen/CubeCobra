FROM node:20.18.0

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/jobs/package*.json ./packages/jobs/
COPY packages/server/package*.json ./packages/server/
COPY packages/utils/package*.json ./packages/utils/

# Install dependencies
RUN npm install --workspaces

# Copy source code
COPY packages/jobs ./packages/jobs
COPY packages/server ./packages/server
COPY packages/utils ./packages/utils
COPY tsconfig.json ./

# Build the projects
RUN npm run build --workspace=packages/utils
RUN npm run build --workspace=packages/server
RUN npm run build --workspace=packages/jobs

# Set working directory to jobs package
WORKDIR /app/packages/jobs

# Default command (can be overridden)
CMD ["npm", "run", "update-all"]
