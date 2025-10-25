FROM node:20-alpine

WORKDIR /app

# Copy package files and install
COPY package*.json ./
RUN npm install --production

# Copy app
COPY . .

EXPOSE 3001

CMD ["node", "server.js"]