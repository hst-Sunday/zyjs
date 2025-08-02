FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install
COPY server-v5.js ./
COPY middleware/ ./middleware/
COPY utils/ ./utils/

ENV PORT=7998
EXPOSE 7998

CMD ["node", "server-v5.js"]