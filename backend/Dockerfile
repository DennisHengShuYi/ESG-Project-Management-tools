FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm config set strict-ssl false && npm ci && node -e "require('express')"

COPY src ./src

EXPOSE 5000
CMD ["node", "src/server.js"]
