# 1. Aşama: Derleme (Build)
FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Vite değişkenleri derleme anında gömülür, bu yüzden ARG olarak alınmalı:
ARG VITE_API_URL
ARG VITE_IMGBB_API_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_IMGBB_API_KEY=$VITE_IMGBB_API_KEY
RUN npm run build

# 2. Aşama: Nginx ile Yayınlama (Production)
FROM nginx:alpine
# SPA fallback ayarı: /cashier, /waiter, /admin adresleri index.html'e düşer.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
