FROM node:22-bookworm-slim AS worker
WORKDIR /app/workers/browser
COPY workers/browser/package.json workers/browser/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY workers/browser/src ./src
COPY workers/browser/sources.example.json ./sources.example.json
COPY supabase/functions/_shared/listing-core.mjs /app/supabase/functions/_shared/listing-core.mjs
RUN mkdir -p data && chown -R node:node data
USER node
ENV HOST=0.0.0.0
EXPOSE 8000
CMD ["node", "src/server.mjs"]

FROM worker AS browser
USER root
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/browsers
RUN npx playwright-core install --with-deps chromium
USER node
CMD ["node", "src/launch-browser.mjs"]
