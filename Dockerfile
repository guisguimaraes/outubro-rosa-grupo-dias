# Site + contador de cliques + painel /admin, num servidor Node sem dependências (deploy no Coolify).
# instagram/ e remotion/ ficam de fora da imagem.
# No Coolify: Ports exposes = 3000, variável ADMIN_PASSWORD e um Persistent Storage montado em /data.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data NODE_NO_WARNINGS=1
COPY server.js index.html admin.html ./
COPY assets ./assets
EXPOSE 3000
CMD ["node", "server.js"]
