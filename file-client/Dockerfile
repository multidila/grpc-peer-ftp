FROM node:20-alpine

WORKDIR /build

# Copy and build protocol package
COPY protocol/ ./protocol/
COPY proto/ ./proto/
RUN cd protocol && npm install && npm run build

# Copy and build file-client
COPY file-client/ ./file-client/
RUN cd file-client && npm install && npm run build

# Set up runtime
WORKDIR /build/file-client
RUN mkdir -p /build/file-client/downloads

CMD ["node", "dist/main.js"]
