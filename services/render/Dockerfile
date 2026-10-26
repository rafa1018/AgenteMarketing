FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

# Instala Chromium + dependencias del sistema operativo necesarias para Playwright headless.
RUN npx playwright install --with-deps chromium

COPY server.js ./

EXPOSE 3000
CMD ["node", "server.js"]
