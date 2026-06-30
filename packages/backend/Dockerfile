FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps --include=dev --ignore-scripts

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build || (echo "=== nest build FAILED ===" && exit 1)
RUN echo "=== dist/ contents ===" && ls -la dist/ 2>/dev/null || echo "dist/ does not exist"
RUN ls -la dist/main.js

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
