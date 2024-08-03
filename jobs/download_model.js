require('dotenv').config();
const fs = require('fs');

const AWS = require('aws-sdk');

const downloadFromS3 = async () => {
  const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  });

  // list all from s3 under s3://cubecobra/model
  const listResult = await s3.listObjectsV2({ Bucket: process.env.DATA_BUCKET, Prefix: 'model/' }).promise();

  // for each file, download it to the local model directory
  for (const file of listResult.Contents) {
    const res = await s3.getObject({ Bucket: process.env.DATA_BUCKET, Key: file.Key }).promise();

    // make sure folders exist
    const folders = file.Key.split('/');
    folders.pop();

    let folderPath = '';
    for (const folder of folders) {
      folderPath += `${folder}/`;
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
      }
    }

    fs.writeFileSync(file.Key, res.Body);
    console.log(`Downloaded ${file.Key}`);
  }
};

downloadFromS3();
