require('dotenv').config();
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

const walkSync = async (currentDirPath, callback) => {
  const children = fs.readdirSync(currentDirPath);
  for (const name of children) {
    const filePath = path.join(currentDirPath, name);
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      // eslint-disable-next-line no-await-in-loop
      await callback(filePath, stat);
    } else if (stat.isDirectory()) {
      walkSync(filePath, callback);
    }
  }
};

const uploadDir = async (s3Path, bucketName) => {
  const s3 = new AWS.S3();
  await walkSync(s3Path, (filePath) => {
    const bucketPath = filePath.substring(s3Path.length + 1);
    const params = {
      Bucket: bucketName,
      Key: bucketPath,
      Body: fs.readFileSync(filePath),
    };
    return s3.upload(params).promise();
  });
};

(async () => {
  await uploadDir(process.argv[2], 'cubecobra');
  process.exit(0);
})();
