FROM node:20-alpine

WORKDIR /build

COPY protocol/ ./protocol/
COPY proto/ ./proto/
RUN cd protocol && npm install && npm run build

COPY tracker/ ./tracker/
RUN cd tracker && npm install && npm run build

WORKDIR /build/tracker

CMD ["node", "dist/main.js"]
