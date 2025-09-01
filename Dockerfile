# ---- Base with Node.js and Python ----
FROM node:20-alpine AS base

# Install Python and system dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    libc6-compat \
    && ln -sf python3 /usr/bin/python

ENV NODE_ENV=production
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production

# ---- Playwright layer (browsers + OS deps) ----
FROM deps AS pw
# Install Playwright dependencies for browser automation
RUN npx playwright install-deps && npx playwright install chromium

# ---- Build ----
FROM pw AS builder
COPY . .
RUN npm run build

# ---- Runtime ----
FROM pw AS runner
WORKDIR /app

# Install Python dependencies
COPY python_scripts/requirements.txt ./python_scripts/
RUN pip3 install --no-cache-dir -r python_scripts/requirements.txt

# Create unprivileged user
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copy built application
COPY --chown=nextjs:nodejs --from=builder /app/public ./public
COPY --chown=nextjs:nodejs --from=builder /app/.next/standalone ./
COPY --chown=nextjs:nodejs --from=builder /app/.next/static ./.next/static

# Copy Python scripts
COPY --chown=nextjs:nodejs python_scripts ./python_scripts

# Copy other necessary files
COPY --chown=nextjs:nodejs scripts ./scripts

# Set up environment
ENV PLAYWRIGHT_BROWSERS_PATH="/app/.cache/ms-playwright"
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD="1"
ENV PORT=8080
ENV PYTHONPATH="/app/python_scripts"

# Switch to unprivileged user
USER nextjs

EXPOSE 8080

# Start Next.js standalone server
CMD ["node", "server.js"]
    