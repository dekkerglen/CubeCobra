FROM node:10

RUN npm install -g nodemon
RUN npm install -g rollup
RUN mkdir -p /CubeCobra/CubeCobra 
RUN mkdir -p /CubeCobra/cubecobrasecrets 
WORKDIR /CubeCobra/CubeCobra
COPY package.json ./
COPY package-lock.json ./
RUN npm install

COPY ./ ./
ENV NODE_ENV=production
RUN npm run setup
RUN npm run build
