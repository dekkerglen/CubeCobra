import { loadEsm } from 'load-esm';

/**
 * Converts markdown text to plain text, stripping all formatting.
 * @param text - The markdown text to convert
 * @returns Plain text representation of the markdown
 */
export async function markdownToText(text?: string): Promise<string> {
  if (!text) {
    return '';
  }

  //Dynamically import ESM modules so that typescript doesn't transpile to commonJS, which these don't support
  const gfm = await loadEsm<typeof import('remark-gfm')>('remark-gfm');
  const math = await loadEsm<typeof import('remark-math')>('remark-math');
  const remark = await loadEsm<typeof import('remark-parse')>('remark-parse');
  const { unified } = await loadEsm<typeof import('unified')>('unified');
  const { toString } = await loadEsm<typeof import('mdast-util-to-string')>('mdast-util-to-string');

  const processor = unified()
    .use(remark as any)
    .use([math, [gfm, { singleTilde: false }]] as any);

  const ast = processor.parse(text);
  processor.runSync(ast);
  return toString(ast);
}

export default {
  markdownToText,
};
