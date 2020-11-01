import syntax from 'markdown/symbols/micromark-extension-symbols';
import { fromMarkdown } from 'markdown/symbols/mdast-extension-symbols';
import { add } from 'markdown/utils';

function symbols(options) {
  if (!options?.allowed) {
    console.warn('[remark-symbols] Warning: no symbols specified!');
  }

  const data = this.data();
  const valid = options?.allowed || '';
  add(data, 'micromarkExtensions', syntax(valid));
  add(data, 'fromMarkdownExtensions', fromMarkdown);
}

export default symbols;
