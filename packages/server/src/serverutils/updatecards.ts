import { s3 } from 'dynamo/s3client';
import crypto from 'crypto';
import fs from 'fs';

import 'dotenv/config';

import { fileToAttribute, loadAllFiles } from './cardCatalog';

interface CardManifest {
  checksum: string;
  version?: string;
}

const MANIFEST_PATH = 'private/manifest.json';

// Lock to prevent concurrent updates
let isUpdating = false;

const downloadManifestFromS3 = async (): Promise<CardManifest | null> => {
  try {
    const res = await s3.getObject({
      Bucket: process.env.DATA_BUCKET!,
      Key: 'cards/manifest.json',
    });
    const manifestContent = await res.Body!.transformToString();
    return JSON.parse(manifestContent);
  } catch (error) {
    console.log('Could not download manifest from S3:', error);
    return null;
  }
};

const loadLocalManifest = (): CardManifest | null => {
  try {
    if (fs.existsSync(MANIFEST_PATH)) {
      const manifestContent = fs.readFileSync(MANIFEST_PATH, 'utf-8');
      return JSON.parse(manifestContent);
    }
  } catch (error) {
    console.log('Could not load local manifest:', error);
  }
  return null;
};

const saveLocalManifest = (manifest: CardManifest): void => {
  try {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    console.log('Saved manifest to disk');
  } catch (error) {
    console.error('Could not save local manifest:', error);
  }
};

const shouldUpdateCards = (localManifest: CardManifest | null, remoteManifest: CardManifest | null): boolean => {
  // If we don't have a remote manifest, don't update
  if (!remoteManifest) {
    console.log('No remote manifest available, skipping update check');
    return false;
  }

  // If we don't have a local manifest, we should update
  if (!localManifest) {
    console.log('No local manifest, will download cards');
    return true;
  }

  // Check if checksum changed
  if (localManifest.checksum !== remoteManifest.checksum) {
    console.log(
      `Card data checksum changed from ${localManifest.checksum.substring(0, 8)}... to ${remoteManifest.checksum.substring(0, 8)}..., will update cards`,
    );
    return true;
  }

  console.log('Card checksums match, no update needed');
  return false;
};

const downloadFromS3 = async (basePath: string = 'private'): Promise<void> => {
  console.log('Downloading card database files from S3...');

  await Promise.all(
    Object.keys(fileToAttribute).map(async (file: string) => {
      const res = await s3.getObject({
        Bucket: process.env.DATA_BUCKET!,
        Key: `cards/${file}`,
      });
      fs.writeFileSync(`${basePath}/${file}`, await res.Body!.transformToString());
      console.log(`Downloaded ${file} from S3 to ${basePath}/${file}`);
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

/**
 * Check the manifest and conditionally update the cardbase.
 * This should be called periodically (e.g., every 30 minutes).
 */
export async function checkAndUpdateCardbase(basePath: string = 'private'): Promise<boolean> {
  // Prevent concurrent updates
  if (isUpdating) {
    console.log('Card database update already in progress, skipping this check');
    return false;
  }

  try {
    isUpdating = true;

    // Download the remote manifest
    const remoteManifest = await downloadManifestFromS3();

    // Load the local manifest
    const localManifest = loadLocalManifest();

    // Check if we need to update
    if (shouldUpdateCards(localManifest, remoteManifest)) {
      console.log('Updating card database...');
      await updateCardbase(basePath);

      // Save the new manifest locally
      if (remoteManifest) {
        saveLocalManifest(remoteManifest);
      }

      console.log('Card database updated successfully');
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking/updating cardbase:', error);
    return false;
  } finally {
    isUpdating = false;
  }
}
