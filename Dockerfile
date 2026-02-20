# Stage 1: Build
FROM oven/bun:1.3.9-alpine AS build

WORKDIR /app

# Copy dependency files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy project files
COPY . .

# Build for production (Nuxt Nitro)
ENV NODE_ENV=production
RUN bun run build

# Stage 2: Runtime
FROM oven/bun:1.3.9-alpine AS runtime

WORKDIR /app

# Copy output from build
COPY --from=build /app/.output ./.output
# Nuxt also needs some files sometimes, but .output contains everything needed by Nitro

# Production environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Expose the application port
EXPOSE 3000

# Start Nuxt Nitro server
CMD ["bun", "./.output/server/index.mjs"]
