import visit from 'unist-util-visit';
import syntax from 'markdown/cardrow/micromark-cardrow';
import { fromMarkdown } from 'markdown/cardrow/mdast-cardrow';
import { add } from 'markdown/utils';

function oncardrow(node, index, parent) {
  node.type = 'element';
  node.tagName = 'cardrow';
  node.inParagraph = parent.type === 'paragraph';
}

function cardrow() {
  const data = this.data();
  add(data, 'micromarkExtensions', syntax);
  add(data, 'fromMarkdownExtensions', fromMarkdown);
  return (tree) => visit(tree, 'cardrow', oncardrow);
}

export default cardrow;
