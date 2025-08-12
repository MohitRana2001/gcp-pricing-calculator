# ---- Base (Node 20 LTS on Alpine) ----
    FROM node:20-alpine AS base
    ENV NODE_ENV=production
    WORKDIR /app
    
    # Playwright needs a few system libs; npx script will handle most, but we add compat
    RUN apk add --no-cache libc6-compat
    
    # ---- Dependencies ----
    FROM base AS deps
    COPY package*.json ./
    # If you use pnpm/yarn, swap to the right installer
    RUN npm ci
    
    # ---- Playwright layer (browsers + OS deps) ----
    FROM deps AS pw
    # Installs OS deps and Chromium only (keeps image smaller)
    RUN npx playwright install-deps && npx playwright install chromium
    
    # ---- Build ----
    FROM pw AS builder
    COPY . .
    # Ensure Next.js outputs standalone server (next.config.js: output: 'standalone')
    # If not set, Next 13+ creates standalone when `output: 'standalone'`
    RUN npm run build
    
    # ---- Runtime ----
    FROM pw AS runner
    WORKDIR /app
    
    # Unprivileged user
    RUN addgroup --system --gid 1001 nodejs \
     && adduser --system --uid 1001 nextjs
    USER nextjs
    
    # Copy only what we need to run the standalone server
    # - .next/standalone contains server.js and node_modules subset
    # - .next/static contains built assets
    # - public for static files
    COPY --chown=nextjs:nodejs --from=builder /app/public ./public
    COPY --chown=nextjs:nodejs --from=builder /app/.next/standalone ./
    COPY --chown=nextjs:nodejs --from=builder /app/.next/static ./.next/static
    
    # Playwright runtime env (so it doesn’t try to download at runtime)
    ENV PLAYWRIGHT_BROWSERS_PATH="/app/.cache/ms-playwright"
    ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD="1"
    
    # Cloud Run port
    ENV PORT=3000
    EXPOSE 3000
    
    # Start Next standalone server
    CMD ["node", "server.js"]
    