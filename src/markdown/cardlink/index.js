import visit from 'unist-util-visit';
import syntax from 'markdown/cardlink/micromark-cardlink';
import { fromMarkdown } from 'markdown/cardlink/mdast-cardlink';
import { add } from 'markdown/utils';

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
    [node.name, node.id] = node.value.split('|');
  }
}

function transform(tree) {
  visit(tree, 'cardlink', oncard);
}

function cardlinks() {
  const data = this.data();
  add(data, 'micromarkExtensions', syntax);
  add(data, 'fromMarkdownExtensions', fromMarkdown);
  return transform;
}

export default cardlinks;
