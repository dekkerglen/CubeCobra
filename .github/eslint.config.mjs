import ESLintDefaults from '../eslint.config.mjs';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default [...ESLintDefaults, eslintPluginPrettierRecommended];
