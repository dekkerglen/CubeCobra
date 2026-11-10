import fs from 'fs';
import os from 'os';
import path from 'path';

// In-memory bucket shared by both S3 clients the downloader creates.
const mockObjects: Record<string, string> = {};

jest.mock('@aws-sdk/client-s3', () => {
  const { Readable } = jest.requireActual('stream');
  // Plain fields rather than TypeScript parameter properties, which jest's mock-factory scope check rejects.
  class GetObjectCommand {
    input: { Key: string };
    constructor(mockInput: { Key: string }) {
      this.input = mockInput;
    }
  }
  class ListObjectsV2Command {
    input: { Prefix: string; ContinuationToken?: string };
    constructor(mockInput: { Prefix: string; ContinuationToken?: string }) {
      this.input = mockInput;
    }
  }
  // Lists two keys per page so every listing exercises pagination.
  class S3Client {
    async send(command: GetObjectCommand | ListObjectsV2Command) {
      if (command instanceof ListObjectsV2Command) {
        const keys = Object.keys(mockObjects)
          .filter((key) => key.startsWith(command.input.Prefix))
          .sort();
        const start = Number(command.input.ContinuationToken ?? 0);
        const truncated = start + 2 < keys.length;
        return {
          Contents: keys.slice(start, start + 2).map((Key) => ({ Key })),
          IsTruncated: truncated,
          NextContinuationToken: truncated ? String(start + 2) : undefined,
        };
      }
      const body = mockObjects[command.input.Key];
      if (body === undefined) {
        throw Object.assign(new Error('The specified key does not exist.'), { name: 'NoSuchKey' });
      }
      return { Body: Object.assign(Readable.from([Buffer.from(body)]), { transformToString: async () => body }) };
    }
  }
  return { GetObjectCommand, ListObjectsV2Command, S3Client };
});

import { downloadModelsFromS3, readLocalModelVersion, relativeModelPath } from '../src/mlutils/downloadModel';

const BUNDLE_FILES = [
  'indexToOracleMap.json',
  'encoder/model.json',
  'cube_decoder/model.json',
  'deck_build_decoder/model.json',
  'draft_decoder/model.json',
];

const putBundle = (prefix: string, contents: string) => {
  for (const file of BUNDLE_FILES) mockObjects[`${prefix}${file}`] = contents;
};

let basePath: string;
const readLocal = (file: string) => fs.readFileSync(path.join(basePath, 'model', file), 'utf8');

beforeEach(() => {
  for (const key of Object.keys(mockObjects)) delete mockObjects[key];
  basePath = fs.mkdtempSync(path.join(os.tmpdir(), 'recommender-model-'));
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  fs.rmSync(basePath, { recursive: true, force: true });
  jest.restoreAllMocks();
});

describe('relativeModelPath', () => {
  it('strips the bundle prefix', () => {
    expect(relativeModelPath('model/20270206-153000/encoder/model.json', 'model/20270206-153000/')).toBe(
      'encoder/model.json',
    );
    expect(relativeModelPath('model/indexToOracleMap.json', 'model/')).toBe('indexToOracleMap.json');
  });

  it('skips directory markers and paths that would leave the model directory', () => {
    expect(relativeModelPath('model/v3/encoder/', 'model/v3/')).toBeNull();
    expect(relativeModelPath('model/v3/../secrets.json', 'model/v3/')).toBeNull();
    expect(relativeModelPath('other/encoder/model.json', 'model/v3/')).toBeNull();
  });
});

describe('downloadModelsFromS3', () => {
  it('downloads the version model/current.json points at', async () => {
    putBundle('model/', 'legacy');
    putBundle('model/20270206-153000/', 'candidate');
    mockObjects['model/current.json'] = JSON.stringify({ version: '20270206-153000', promotedAt: 1 });

    await expect(downloadModelsFromS3(basePath, 'data-bucket')).resolves.toBe('20270206-153000');
    expect(readLocal('encoder/model.json')).toBe('candidate');
    expect(readLocalModelVersion(basePath)).toBe('20270206-153000');
  });

  it('falls back to the legacy flat files when there is no pointer', async () => {
    putBundle('model/', 'legacy');
    putBundle('model/20270206-153000/', 'candidate');

    await expect(downloadModelsFromS3(basePath, 'data-bucket')).resolves.toBe('v3');
    expect(readLocal('draft_decoder/model.json')).toBe('legacy');
    expect(fs.existsSync(path.join(basePath, 'model', '20270206-153000'))).toBe(false);
  });

  it('keeps the local model when it is already the pointer version', async () => {
    putBundle('model/v3/', 'first');
    mockObjects['model/current.json'] = JSON.stringify({ version: 'v3', promotedAt: 1 });
    await downloadModelsFromS3(basePath, 'data-bucket');

    putBundle('model/v3/', 'second');
    await expect(downloadModelsFromS3(basePath, 'data-bucket')).resolves.toBe('v3');
    expect(readLocal('encoder/model.json')).toBe('first');
  });
});
