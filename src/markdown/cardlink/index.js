import { visit } from 'unist-util-visit';

import { fromMarkdown } from 'markdown/cardlink/mdast-cardlink';
import syntax from 'markdown/cardlink/micromark-cardlink';
import { add } from 'markdown/utils';

function oncard(node, index, parent) {
  if (node.value[0] === '!') {
    // Begins with an exclamation point -> it's a card image
    node.value = node.value.substring(1);
    node.type = 'cardimage';
  }

  if (node.value[0] === '/') {
    // Begins with a slash -> include back side in autocard
    node.value = node.value.substring(1);
    node.dfc = true;
  }

  if (node.value[0] === '!' && node.type !== 'cardimage') {
    // Check for exclamation point again in case we began with "/!"
    node.value = node.value.substring(1);
    node.type = 'cardimage';
  }

  if (node.type === 'cardimage' && (parent.type === 'paragraph' || parent.inParagraph)) {
    // Needed to determine whether the image is rendered in a div or in a span
    node.inParagraph = true;
  }

  [node.name, node.id] = node.value.split('|');
  if (typeof node.id === 'undefined') node.id = node.name;

  node.data.hName = node.type;
  node.data.hProperties = { name: node.name, id: node.id, dfc: node.dfc, inParagraph: node.inParagraph };
}

function cardlinks() {
  const data = this.data();
  add(data, 'micromarkExtensions', syntax);
  add(data, 'fromMarkdownExtensions', fromMarkdown);
  return (tree) => visit(tree, 'cardlink', oncard);
}

export default cardlinks;
