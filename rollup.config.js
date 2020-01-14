export default {
  input: ['src/util/Filter.js', 'src/util/Card.js', 'src/util/draftutil.js', 'src/util/Util.js'],
  output: {
    dir: 'dist/util',
    format: 'cjs',
  },
  watch: {
    clearScreen: false,
  },
};
