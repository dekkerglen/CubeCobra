const generateMeta = require('../../serverjs/meta');

test('generateMeta returns the expected object', () => {
  const title = 'the title';
  const description = 'the description';
  const image = 'a real image url';
  const url = 'a real og url';
  const width = 69;
  const height = 420;
  const expected = [
    {
      property: 'og:title',
      content: title,
    },
    {
      property: 'og:description',
      content: description,
    },
    {
      property: 'og:image',
      content: image,
    },
    {
      property: 'og:url',
      content: url,
    },
    {
      property: 'og:image:width',
      content: width || '',
    },
    {
      property: 'og:image:height',
      content: height || '',
    },
    {
      property: 'twitter:card',
      content: 'summary_large_image',
    },
    {
      property: 'twitter:title',
      content: title,
    },
    {
      property: 'twitter:description',
      content: description,
    },
    {
      property: 'twitter:image',
      content: image,
    },
    {
      property: 'twitter:url',
      content: url,
    },
  ];
  const result = generateMeta(title, description, image, url, width, height);
  expect(result).toEqual(expected);
});
