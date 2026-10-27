# Single-container production image: Express API + built React site on one port.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci --no-audit --no-fund
COPY client client
COPY server server
RUN npm run build -w @aurum/client

FROM node:20-alpine AS runtime
ENV NODE_ENV=production PORT=5000
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci --omit=dev --workspace @aurum/server --include-workspace-root=false --no-audit --no-fund && npm cache clean --force
COPY server/src server/src
COPY --from=build /app/client/dist client/dist
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:5000/api/health || exit 1
CMD ["node", "server/src/server.js"]
