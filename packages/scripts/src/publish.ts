import { S3 } from '@aws-sdk/client-s3';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { Upload } from '@aws-sdk/lib-storage';
import archiver from 'archiver';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const s3 = new S3({
  endpoint: process.env.AWS_ENDPOINT || undefined,
  forcePathStyle: !!process.env.AWS_ENDPOINT,
  credentials: fromNodeProviderChain(),
  region: process.env.AWS_REGION,
});

// get version from environment variable (for CI/CD) or root package.json (for local dev)
const rootPackageJsonPath = path.resolve(__dirname, '../../../package.json');
const packageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8')) as { version: string };
const VERSION: string = process.env.BUILD_VERSION || packageJson.version;

const bucketName: string = process.env.CUBECOBRA_APP_BUCKET || 'cubecobra';
const zipFileName: string = `builds/${VERSION}.zip`;

// Define paths relative to server package
const serverPath: string = path.resolve(__dirname, '../../server');
const zipFilePath: string = path.join(serverPath, 'target.zip');

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

archive.on('error', function (err: Error) {
  throw err;
});

archive.pipe(output);

// List of files or directories to ignore
const ignore: string[] = [
  '**/node_modules/**',
  'target.zip',
  '.env',
  '.gitignore',
  '.git/**',
  'src/**', // Exclude TypeScript source files
  'model/**', // Exclude model files
  'temp/**', // Exclude temp files
  'private/**', // Exclude private files
  'public/**', // Exclude public files (already copied to dist)
  'tsconfig.json',
  'tsconfig.test.json',
  'babel.config.js',
  'babel.config.mjs',
  'jsconfig.json',
  'nodemon.json',
  '.esprintrc',
  '.yarnrc.yml',
  '.platform/**',
  'scripts/**', // Exclude build scripts
];

// Change to server directory and archive from there
process.chdir(serverPath);

// append files from server directory, putting its contents at the root of archive
archive.glob('**/*', { ignore, dot: true });

archive.finalize();
