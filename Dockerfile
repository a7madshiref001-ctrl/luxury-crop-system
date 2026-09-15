FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-fund --no-audit
COPY --chown=node:node . .
RUN mkdir -p /data && chown node:node /data
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=5050 DATA_DIR=/data
EXPOSE 5050
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:5050/api/menu').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
