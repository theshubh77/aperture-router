# Multi-stage production container for Aperture Router
FROM node:24-alpine AS runner

WORKDIR /app

# Ensure unprivileged execution
USER node

COPY --chown=node:node package.json router.config.json ./
COPY --chown=node:node src/ ./src/
COPY --chown=node:node public/ ./public/

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/health || exit 1

CMD ["node", "src/index.js"]
