// Copy of https://github.com/lukechilds/merge-images
// With the following pull request:
// #87 Add top/bottom/left/right/width/height options. Created by RedSparr0w
// When this pull request is merged this file can be deleted.

// Defaults
const defaultOptions = {
  format: 'image/png',
  quality: 0.92,
  width: undefined,
  height: undefined,
  Canvas: undefined,
  crossOrigin: undefined,
};

function getX(image, width) {
  if (image.right !== undefined) return width - (image.right + (image.width || image.img.width));
  return image.left || image.x || 0;
}

function getY(image, height) {
  if (image.bottom !== undefined) return height - (image.bottom + (image.height || image.img.height));
  return image.top || image.y || 0;
}

// Return Promise
const mergeImages = (sources = [], options = {}) =>
  new Promise((resolve) => {
    options = { ...defaultOptions, ...options };

    // Setup browser/Node.js specific variables
    const canvas = options.Canvas ? new options.Canvas() : window.document.createElement('canvas');
    const Image = options.Image || window.Image;

    // Load sources
    const images = sources.map(
      (source) =>
        // eslint-disable-next-line no-shadow
        new Promise((resolve, reject) => {
          // Convert sources to objects
          if (source.constructor.name !== 'Object') {
            source = { src: source };
          }

          // Resolve source and img when loaded
          const img = new Image();
          img.crossOrigin = options.crossOrigin;
          img.onerror = () => reject(new Error(`Couldn't load image '${source.src}'`));
          img.onload = () => resolve({ ...source, img });
          img.src = source.src;
        }),
    );

    // Get canvas context
    const ctx = canvas.getContext('2d');

    // When sources have loaded
    resolve(
      // eslint-disable-next-line no-shadow
      Promise.all(images).then((images) => {
        // Set canvas dimensions
        const getSize = (dim) => options[dim] || Math.max(...images.map((image) => image.img[dim]));
        canvas.width = getSize('width');
        canvas.height = getSize('height');

        // Draw images to canvas
        images.forEach((image) => {
          ctx.globalAlpha = image.opacity ? image.opacity : 1;
          return ctx.drawImage(
            image.img,
            getX(image, canvas.width),
            getY(image, canvas.height),
            image.width || image.img.width,
            image.height || image.img.height,
          );
        });

        if (options.Canvas && options.format === 'image/jpeg') {
          // Resolve data URI for node-canvas jpeg async
          // eslint-disable-next-line no-shadow
          return new Promise((resolve, reject) => {
            canvas.toDataURL(
              options.format,
              {
                quality: options.quality,
                progressive: false,
              },
              (err, jpeg) => {
                if (err) {
                  reject(err);
                  return;
                }
                resolve(jpeg);
              },
            );
          });
        }

        // Resolve all other data URIs sync
        return canvas.toDataURL(options.format, options.quality);
      }),
    );
  });

module.exports = mergeImages;
