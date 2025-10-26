FROM node:20-alpine

WORKDIR /app

# Create mount point for persistent scores (Fly volume should target /data)
ENV DATA_DIR=/data
ENV PORT=8080
RUN mkdir -p "${DATA_DIR}"

COPY server.js .

EXPOSE 8080

CMD ["node", "server.js"]
