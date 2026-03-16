FROM node:20-alpine

WORKDIR /build

# Copy and build protocol package
COPY protocol/ ./protocol/
COPY proto/ ./proto/
RUN cd protocol && npm install && npm run build

# Copy and build file-server
COPY file-server/ ./file-server/
RUN cd file-server && npm install && npm run build

# Set up runtime
WORKDIR /build/file-server
RUN mkdir -p /build/file-server/shared

CMD ["node", "dist/main.js"]
