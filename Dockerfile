# Rezonans backend (Hono + tsx). Single-stage; tsx runs the TS directly.
FROM node:24-alpine

WORKDIR /app

# Install deps (incl. tsx, needed to run at start)
COPY package.json package-lock.json* ./
RUN npm ci

# App source
COPY . .

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# Persist notifications across restarts by mounting a volume at /app/data
VOLUME ["/app/data"]

CMD ["npm", "start"]
