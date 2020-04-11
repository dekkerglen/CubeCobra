FROM node:13

RUN mkdir -p /CubeCobra/CubeCobra && mkdir -p /CubeCobra/cubecobrasecrets 
WORKDIR /CubeCobra/CubeCobra
RUN npm install -g nodemon rollup
COPY package*.json ./
RUN npm install && npm cache clean --force

ENV NODE_ENV=production
COPY src/ src/
COPY webpack* ./
COPY babel.config.js ./
RUN npm run build

COPY ./ ./
