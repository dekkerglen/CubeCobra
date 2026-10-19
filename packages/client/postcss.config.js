module.exports = {
  plugins: {
    // Tailwind 4 moved the PostCSS plugin into its own package and now handles vendor
    // prefixing internally, so autoprefixer is no longer part of this pipeline.
    '@tailwindcss/postcss': {},
  },
};
