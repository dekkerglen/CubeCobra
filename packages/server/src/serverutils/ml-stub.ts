// Stub implementation of ML module for Lambda environment
// This allows code to import from ml.ts without requiring TensorFlow

export async function initializeMl(_rootDir: string = '.') {
  console.warn('ML module is stubbed - ML features will not work');
}

export const ensureModelsReady = (_timeout = 30000): Promise<void> => {
  console.warn('ML module is stubbed - ML features will not work');
  return Promise.resolve();
};

export const encode = (_oracles: string[]) => {
  throw new Error('ML features are not available in this environment');
};

export const recommend = (_oracles: string[]) => {
  throw new Error('ML features are not available in this environment');
};

export const build = (_oracles: string[]) => {
  throw new Error('ML features are not available in this environment');
};

export const draft = (_pack: string[], _pool: string[]) => {
  throw new Error('ML features are not available in this environment');
};

export const oracleInData = (_oracle: string) => {
  return false;
};
