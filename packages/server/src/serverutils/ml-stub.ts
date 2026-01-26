// Stub implementation of ML module for Lambda environment
// This allows code to import from ml.ts without requiring TensorFlow

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
