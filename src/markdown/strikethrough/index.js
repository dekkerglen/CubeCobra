import syntax from 'micromark-extension-gfm';
import fromMarkdown from 'mdast-util-gfm/from-markdown';
import { add } from 'markdown/utils';

function strikethrough(options) {
  const data = this.data();

  add(data, 'micromarkExtensions', syntax(options));
  add(data, 'fromMarkdownExtensions', fromMarkdown);
}

export default strikethrough;
