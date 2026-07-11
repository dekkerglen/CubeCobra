import { Changes, isBoardChanges } from '@utils/datatypes/Card';

interface MetaTag {
  property: string;
  content: string;
}

const stripMarkdown = (text: string): string =>
  text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}>+\s?/gm, '')
    .replace(/^\s{0,3}#+\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/^\s{0,3}\d+\.\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

export const truncateForMeta = (text: string | undefined | null, maxLength = 280): string => {
  if (!text) return '';
  const stripped = stripMarkdown(text);
  if (stripped.length <= maxLength) return stripped;
  return stripped.slice(0, maxLength - 1).trimEnd() + '…';
};

export const summarizeChangelist = (changelog: Partial<Changes> | undefined): string => {
  if (!changelog) return '';
  let added = 0;
  let removed = 0;
  let swapped = 0;
  let edited = 0;
  for (const [key, value] of Object.entries(changelog)) {
    if (key === 'version' || !isBoardChanges(value)) continue;
    added += value.adds?.length ?? 0;
    removed += value.removes?.length ?? 0;
    swapped += value.swaps?.length ?? 0;
    edited += value.edits?.length ?? 0;
  }
  const parts: string[] = [];
  if (added) parts.push(`+${added} added`);
  if (removed) parts.push(`-${removed} removed`);
  if (swapped) parts.push(`${swapped} swapped`);
  if (edited) parts.push(`${edited} edited`);
  return parts.join(', ');
};

const generateMeta = (
  title: string,
  description: string | undefined,
  image: string,
  url: string,
  width?: string | number,
  height?: string | number,
): MetaTag[] => {
  // Descriptions are often raw markdown (e.g. a cube's brief). Social platforms
  // render meta content verbatim, so strip the markdown down to plain text here —
  // callers that already ran truncateForMeta pass plain text and this is a no-op.
  const plainDescription = description ? stripMarkdown(description) : '';
  return [
    {
      property: 'og:title',
      content: title,
    },
    {
      property: 'og:description',
      content: plainDescription,
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
      content: plainDescription,
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
