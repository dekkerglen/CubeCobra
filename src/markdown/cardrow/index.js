import syntax from 'markdown/cardrow/micromark-cardrow';
import { fromMarkdown } from 'markdown/cardrow/mdast-cardrow';
import { add } from 'markdown/utils';

function cardrow() {
  const data = this.data();
  add(data, 'micromarkExtensions', syntax);
  add(data, 'fromMarkdownExtensions', fromMarkdown);
}

export default cardrow;
