FROM node:18-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm install --legacy-peer-deps --include=dev

COPY . .
RUN npm run build
RUN ls -la dist/main.js

CMD ["node", "dist/main"]
