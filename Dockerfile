# Site estático servido pelo Nginx (deploy no Coolify). Só o site vai pra imagem:
# instagram/ e remotion/ ficam de fora.
FROM nginx:1.27-alpine
COPY index.html /usr/share/nginx/html/
COPY assets /usr/share/nginx/html/assets
EXPOSE 80
