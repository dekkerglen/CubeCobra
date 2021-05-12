// Load Environment Variables
require('dotenv').config();
const AWS = require('aws-sdk');
const fs = require('fs');
const mongoose = require('mongoose');

const { winston } = require('./serverjs/cloudwatch');
const updatedb = require('./serverjs/updatecards.js');
const CardRating = require('./models/cardrating');

winston.configure({
  level: 'info',
  format: winston.format.simple(),
  exitOnError: false,
  transports: [new winston.transports.Console()],
});

const S3_BUCKET = 'cubecobra';
const S3_PREFIX = 'cards/';

(async () => {
  if (
    process.env.AWS_ACCESS_KEY &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    !(process.argv.length > 2 && process.argv[2] === 'nos3')
  ) {
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
    const { Contents: contents } = await s3.listObjectsV2({ Bucket: S3_BUCKET, Prefix: S3_PREFIX }).promise();
    const promises = contents
      .filter(({ Key }) => Key[Key.length - 1] !== '/')
      .map(
        ({ Key }) =>
          new Promise((resolve, reject) => {
            const sections = Key.split('/');
            const filename = sections[sections.length - 1];
            const file = fs.createWriteStream(`./private/${filename}`);
            s3.getObject({ Bucket: S3_BUCKET, Key })
              .createReadStream()
              .on('end', () => resolve)
              .on('error', reject)
              .pipe(file);
          }),
      );
    await Promise.all(promises);
  } else {
    await mongoose.connect(process.env.MONGODB_URL);
    const ratings = await CardRating.find({}, 'name elo embedding').lean();
    await updatedb.updateCardbase(ratings);
    mongoose.disconnect();
  }
  process.exit();
})();
