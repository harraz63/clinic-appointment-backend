FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS dev
COPY . .
RUN chmod +x ./docker/start-dev.sh
EXPOSE 3000
CMD ["sh", "./docker/start-dev.sh"]

FROM base AS build
COPY . .
RUN npm run build

FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/docker ./docker
RUN chmod +x ./docker/start-prod.sh
EXPOSE 3000
CMD ["sh", "./docker/start-prod.sh"]
