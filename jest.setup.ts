import path from 'path';

//Load the .env_EXAMPLE into the process environment variables for the tests
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: path.resolve(process.cwd(), '.env_EXAMPLE') });

//Mock the ML utility because when the file runs it tries to load all the models (which takes a while)
jest.mock('src/util/ml', () => ({
  recommend: jest.fn(),
  build: jest.fn(),
  draft: jest.fn(),
  encode: jest.fn(),
}));

import '@testing-library/jest-dom';
