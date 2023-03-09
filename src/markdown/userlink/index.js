import syntax from 'markdown/userlink/micromark-userlink';
import { fromMarkdown } from 'markdown/userlink/mdast-userlink';
import { add } from 'markdown/utils';
import visit from 'unist-util-visit';

function userlink(options = {}) {
  const data = this.data();
  add(data, 'micromarkExtensions', syntax);
  add(data, 'fromMarkdownExtensions', fromMarkdown);

  function visitor(node) {
	node.type = 'element';
	node.tagName = 'userlink';
	node.children = [];
    if (typeof options.callback === 'function') {
      options.callback(node.value);
    }
  }

  return (tree) => visit(tree, 'userlink', visitor);
}

export default userlink;
