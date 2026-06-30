FROM node:18-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps --include=dev --ignore-scripts

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build
RUN ls -la dist/main.js

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
