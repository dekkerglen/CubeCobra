export default {
  input: ['src/utils/Filter.js', 'src/utils/Card.js', 'src/utils/draftutil.js', 'src/utils/Util.js'],
  output: {
    dir: 'dist/utils',
    format: 'cjs',
  },
  watch: {
    clearScreen: false,
  },
};
