FROM node:20-slim

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build client and server bundles
RUN npm run build

# Default Hugging Face port is 7860, default local/render is 3000
ENV PORT=7860
ENV NODE_ENV=production

EXPOSE 7860

# Start compiled server
CMD ["node", "dist/server.cjs"]
