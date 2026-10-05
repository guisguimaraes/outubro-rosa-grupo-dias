# Site estático servido pelo Nginx (deploy no Coolify). Só o site vai pra imagem:
# instagram/ e remotion/ ficam de fora.
FROM nginx:1.27-alpine
# Nginx na porta 3000, a padrão do Coolify (Ports exposes = 3000)
RUN sed -i -E 's/listen(\s+)80;/listen\13000;/; s/listen(\s+)\[::\]:80;/listen\1[::]:3000;/' /etc/nginx/conf.d/default.conf \
 && grep -q "listen.*3000;" /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/
COPY assets /usr/share/nginx/html/assets
EXPOSE 3000
