const generateMeta = function(title, description, image, url) {
  return [{
    property: 'og:title',
    content: title
  }, {
    property: 'og:description',
    content: description
  }, {
    property: 'og:image',
    content: image
  }, {
    property: 'og:url',
    content: url
  }, {
    property: 'twitter:card',
    content: 'summary_large_image'
  }, {
    property: 'twitter:title',
    content: title
  }, {
    property: 'twitter:description',
    content: description
  }, {
    property: 'twitter:image',
    content: image
  }, {
    property: 'twitter:url',
    content: url
  }];
};

module.exports = generateMeta;