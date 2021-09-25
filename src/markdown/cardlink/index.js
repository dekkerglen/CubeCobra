import visit from 'unist-util-visit';
import syntax from 'markdown/cardlink/micromark-cardlink';
import { fromMarkdown } from 'markdown/cardlink/mdast-cardlink';
import { add } from 'markdown/utils';

function oncard(node, index, parent) {
  if (node.value[0] === '!') {
    node.value = node.value.substring(1);
    node.type = 'cardimage';
  }

  if (node.value[0] === '/') {
    node.value = node.value.substring(1);
    node.dfc = true;
  }

  if (node.value[0] === '!' && node.type !== 'cardimage') {
    node.value = node.value.substring(1);
    node.type = 'cardimage';
  }

  if (node.type === 'cardimage' && (parent.type === 'paragraph' || parent.inParagraph)) {
    node.inParagraph = true;
  }

  [node.name, node.id] = node.value.split('|');
  if (typeof node.id === 'undefined') node.id = node.name;
}

function cardlinks() {
  const data = this.data();
  add(data, 'micromarkExtensions', syntax);
  add(data, 'fromMarkdownExtensions', fromMarkdown);
  return (tree) => visit(tree, 'cardlink', oncard);
}

export default cardlinks;
