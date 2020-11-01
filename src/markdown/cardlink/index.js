import visit from 'unist-util-visit';
import syntax from 'markdown/cardlink/micromark-extension-cardlink';
import { fromMarkdown } from 'markdown/cardlink/mdast-util-cardlink';
import { add } from 'markdown/utils';

export default cardlinks;

function cardlinks() {
  const data = this.data();
  add(data, 'micromarkExtensions', syntax);
  add(data, 'fromMarkdownExtensions', fromMarkdown);
  return transform;
}

function transform(tree) {
  visit(tree, 'cardlink', oncard);
}

function oncard(node, index, parent) {
  console.log(`Found cardlink "${node.value}"`);
  if (node.value[0] === '!') {
    node.value = node.value.substring(1);
    node.type = 'cardimage';
  }

  if (node.value[0] === '/') {
    node.value = node.value.substring(1);
    node.dfc = true;
  }

  if (node.type === 'cardlink') {
    const split = node.value.split('|');
    node.name = split[0];
    node.id = split[1];
  }
}
