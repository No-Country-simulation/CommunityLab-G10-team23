# Astro 7 requiere Node >= 22.23
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

# El servidor standalone de @astrojs/node lee HOST y PORT al arrancar;
# BACKEND_URL lo inyecta docker-compose en tiempo de ejecución.
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000

# Usuario sin privilegios incluido en la imagen oficial de Node
USER node

CMD ["node", "./dist/server/entry.mjs"]
