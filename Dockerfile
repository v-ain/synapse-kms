# --- Этап 1: Сборка всего монорепозитория ---
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/client/package.json ./apps/client/
COPY apps/server/package.json ./apps/server/
COPY packages/db-scripts/package.json ./packages/db-scripts/
COPY packages/shared/package.json ./packages/shared/
COPY packages/trpc/package.json ./packages/trpc/

RUN npm ci
COPY . .
RUN npm run build

# --- Этап 2: Финальный образ SERVER ---
FROM node:22-alpine AS server
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/
COPY packages/trpc/package.json ./packages/trpc/
RUN npm ci --omit=dev

COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/trpc/dist ./packages/trpc/dist

# Порт берется из вашей переменной SERVER_PORT внутри контейнера
EXPOSE 3037
CMD ["node", "apps/server/dist/index.js"]

# --- Этап 3: Финальный образ CLIENT (Nginx) ---
FROM nginx:stable-alpine AS client
COPY --from=builder /app/apps/client/dist /usr/share/nginx/html
# Копируем созданный конфиг Nginx
COPY apps/client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

