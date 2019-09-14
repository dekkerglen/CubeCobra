'use strict'
const awsServerlessExpress = require('aws-serverless-express');
const app = require('./app');
const binaryMimeTypes = [
  'application/octet-stream',
  'application/zip',
  'font/eot',
  'font/opentype',
  'font/otf',
  'image/jpeg',
  'image/png',
  'image/svg+xml'
];
const server = awsServerlessExpress.createServer(app, null, binaryMimeTypes);
exports.handler = (event, context) => awsServerlessExpress.proxy(server, event, context);
