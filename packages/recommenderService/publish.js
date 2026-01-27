const { S3 } = require('@aws-sdk/client-s3');
const { fromNodeProviderChain } = require('@aws-sdk/credential-providers');
const { Upload } = require('@aws-sdk/lib-storage');
const archiver = require('archiver');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const s3 = new S3({
  endpoint: process.env.AWS_ENDPOINT || undefined,
  forcePathStyle: !!process.env.AWS_ENDPOINT,
  credentials: fromNodeProviderChain(),
  region: process.env.AWS_REGION,
});

// get version from environment variable (for CI/CD) or root package.json (for local dev)
const rootPackageJsonPath = path.resolve(__dirname, '../../package.json');
const packageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8'));
const VERSION = process.env.BUILD_VERSION || packageJson.version;

const bucketName = process.env.CUBECOBRA_APP_BUCKET || 'cubecobra';
const zipFileName = `builds/recommender-${VERSION}.zip`;

// Define paths relative to recommenderService package
const recommenderPath = __dirname;
const zipFilePath = path.join(recommenderPath, 'target.zip');

const output = fs.createWriteStream(zipFilePath);
const archive = archiver('zip');

// first we delete the zip file if it exists
if (fs.existsSync(zipFilePath)) {
  fs.unlinkSync(zipFilePath);
}

output.on('close', function () {
  console.log(`${archive.pointer()} total bytes`);
  console.log('archiver has been finalized and the output file descriptor has closed.');

  // upload the zip file to s3
  const fileStream = fs.createReadStream(zipFilePath);
  fileStream.on('open', async function () {
    const params = {
      Bucket: bucketName,
      Key: zipFileName,
      Body: fileStream,
    };

    try {
      const data = await new Upload({
        client: s3,
        params,
      }).done();

      console.log('Upload Success', data.Location);
    } catch (err) {
      console.log('Error', err);
    }
  });
});

archive.on('error', function (err) {
  throw err;
});

archive.pipe(output);

// List of files or directories to ignore
const ignore = [
  '**/node_modules/**',
  'target.zip',
  '.env',
  '.gitignore',
  '.git/**',
  'src/**', // Exclude TypeScript source files
  'model/**', // Exclude model files (will be downloaded on startup)
  'private/**', // Exclude private files (will be downloaded on startup)
  'test/**',
  'tsconfig.json',
  'nodemon.json',
  '.esprintrc',
  '.yarnrc.yml',
  'scripts/**', // Exclude build scripts
];

// Change to recommender service directory and archive from there
process.chdir(recommenderPath);

// append files from recommenderService directory, putting its contents at the root of archive
archive.glob('**/*', { ignore, dot: true, gitignore: false });

archive.finalize();
