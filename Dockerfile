FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx next build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 SCHEDULER_INTERVAL_MINUTES=15 EXCEL_FILE=data/ML_Learning_Tracker.xlsx
COPY --from=build /app/package.json /app/next.config.mjs ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
# The Excel file and portal settings live in /app/data - mount a volume there so they survive redeploys.
RUN mkdir -p data && chown -R node:node /app/data
USER node
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0"]
