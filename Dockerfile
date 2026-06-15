FROM node:lts-slim as build
COPY package.json package-lock.json .
RUN npm ci
COPY . .
RUN npm run compile
RUN npm run sqlite:migrate


FROM node:lts-slim
ENV NODE_ENV=production
EXPOSE 8888/tcp
WORKDIR /opt/server/engine
COPY package.json package-lock.json .
RUN npm ci --omit dev --ignore-scripts

# build output
COPY --from=build out out
COPY --from=build db.sqlite db.sqlite

# local non-node dependencies
COPY --from=build public public
COPY --from=build data data
COPY --from=build view view

ENTRYPOINT ["node", "--conditions=production", "out/src/app.js"]