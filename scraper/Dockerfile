# Playwright with Chromium pre-installed.
# This image includes all system dependencies (libx11, libnss3, etc.)
# so Playwright's bundled browser just works.
FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app

# Install dependencies (only production)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npx playwright install chromium

# Copy source
COPY src/ src/

# Run the scraper (exits after completion)
CMD ["node", "src/scrape.mjs"]
