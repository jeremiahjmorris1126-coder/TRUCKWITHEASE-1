FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --include=optional
COPY src ./src
ENV NODE_ENV=production
USER node
CMD ["node", "src/server.js"]
