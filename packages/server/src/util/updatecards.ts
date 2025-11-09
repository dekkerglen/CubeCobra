import 'dotenv/config';
import fs from 'fs';

import { s3 } from '../dynamo/s3client';
import { fileToAttribute, loadAllFiles } from './cardCatalog';

const downloadFromS3 = async (basePath: string = 'private'): Promise<void> => {
  await Promise.all(
    Object.keys(fileToAttribute).map(async (file: string) => {
      const res = await s3.getObject({
        Bucket: process.env.DATA_BUCKET!,
        Key: `cards/${file}`,
      });
      fs.writeFileSync(`${basePath}/${file}`, await res.Body!.transformToString());
    }),
  );
};

export async function updateCardbase(basePath: string = 'private'): Promise<void> {
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath);
  }

  await downloadFromS3(basePath);
  await loadAllFiles(basePath);
}
