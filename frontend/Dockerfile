
# frontend/Dockerfile
FROM node:18

WORKDIR /app

# Copy only package files first (for layer caching)
COPY package*.json ./

# Clean npm cache and install fresh
RUN rm -rf node_modules package-lock.json && npm cache clean --force && npm install

# Then copy the rest of your code
COPY . .

# Start dev server
CMD ["npm", "run", "dev"]
