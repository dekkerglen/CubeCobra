import { fromMarkdown } from 'markdown/symbols/mdast-symbols';
import syntax from 'markdown/symbols/micromark-symbols';
import { add } from 'markdown/utils';

// characters allowed inside a symbol definition by default
const DEFAULT_ALLOWED = 'wubrgcmtsqepxyz/-0123456789';

function symbols(options) {
  const data = this.data();
  const valid = options?.allowed || DEFAULT_ALLOWED;
  add(data, 'micromarkExtensions', syntax(valid));
  add(data, 'fromMarkdownExtensions', fromMarkdown);
}

export default symbols;
