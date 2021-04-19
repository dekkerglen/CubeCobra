import syntax from 'markdown/centering/micromark-centering';
import { fromMarkdown } from 'markdown/centering/mdast-centering';
import { add } from 'markdown/utils';

function centering() {
  const data = this.data();
  add(data, 'micromarkExtensions', syntax);
  add(data, 'fromMarkdownExtensions', fromMarkdown);
}

export default centering;
