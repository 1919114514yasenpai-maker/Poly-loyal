FROM node:20-slim

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build client and server bundles
RUN npm run build

# Default port (Back4App and Render use PORT env var or 3000)
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

# Start compiled server with aggressive garbage collection limit (200MB max for 256MB containers)
CMD ["node", "--max-old-space-size=200", "dist/server.cjs"]
