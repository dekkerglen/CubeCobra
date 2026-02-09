import { toString } from 'mdast-util-to-string';
import gfm from 'remark-gfm';
import math from 'remark-math';
import remark from 'remark-parse';
import { unified } from 'unified';

// remark plugins that are necessary in all use-cases
const BASE_PLUGINS = [math, [gfm, { singleTilde: false }]];

/**
 * Converts markdown text to plain text, stripping all formatting.
 * @param text - The markdown text to convert
 * @returns Plain text representation of the markdown
 */
export function markdownToText(text?: string): string {
  if (!text) {
    return '';
  }
  const processor = unified()
    .use(remark)
    .use(BASE_PLUGINS as any);

  const ast = processor.parse(text);
  processor.runSync(ast);
  return toString(ast);
}

export default {
  markdownToText,
};
