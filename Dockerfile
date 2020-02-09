FROM node:10

RUN mkdir -p /CubeCobra/CubeCobra && mkdir -p /CubeCobra/cubecobrasecrets 
WORKDIR /CubeCobra/CubeCobra
RUN npm install -g nodemon rollup
COPY package*.json ./
RUN npm install && npm cache clean --force

COPY ./ ./
ENV NODE_ENV=production
RUN npm run setup && npm run build
