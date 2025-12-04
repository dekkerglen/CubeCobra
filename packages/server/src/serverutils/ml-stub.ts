// Stub implementation of ML module for Lambda environment
// This allows code to import from ml.ts without requiring TensorFlow

export async function initializeMl() {
  console.warn('ML module is stubbed - ML features will not work');
}

export const ensureModelsReady = (): Promise<void> => {
  console.warn('ML module is stubbed - ML features will not work');
  return Promise.resolve();
};

export const encode = () => {
  throw new Error('ML features are not available in this environment');
};

export const recommend = () => {
  throw new Error('ML features are not available in this environment');
};

export const build = () => {
  throw new Error('ML features are not available in this environment');
};

export const draft = () => {
  throw new Error('ML features are not available in this environment');
};

export const oracleInData = () => {
  return false;
};
