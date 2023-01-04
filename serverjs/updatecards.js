const fs = require('fs');
const AWS = require('aws-sdk');
const carddb = require('./cards');

const downloadFromS3 = async (basePath = 'private') => {
  const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  });

  await Promise.all(
    Object.keys(carddb.fileToAttribute).map(async (file) => {
      const res = await s3
        .getObject({
          Bucket: 'cubecobra',
          Key: `cards/${file}`,
        })
        .promise();
      await fs.writeFileSync(`${basePath}/${file}`, res.Body);
    }),
  );
};

async function updateCardbase(basePath = 'private', defaultPath = null, allPath = null) {
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath);
  }

  await downloadFromS3(basePath, defaultPath, allPath);
}

module.exports = {
  updateCardbase,
};
