interface MetaTag {
  property: string;
  content: string;
}

const generateMeta = (
  title: string,
  description: string,
  image: string,
  url: string,
  width?: string | number,
  height?: string | number,
): MetaTag[] => {
  return [
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
      content: width?.toString() || '',
    },
    {
      property: 'og:image:height',
      content: height?.toString() || '',
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
};

export default generateMeta;
