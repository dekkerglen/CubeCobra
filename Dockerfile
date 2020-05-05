FROM node:13

RUN mkdir -p /CubeCobra
WORKDIR /CubeCobra

RUN npm install mongoose dotenv fs winston node-fetch url sanitize-html

COPY ./serverjs ./serverjs
COPY ./models ./models
COPY ./jobs ./jobs
