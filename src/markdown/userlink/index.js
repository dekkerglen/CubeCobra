import syntax from 'markdown/userlink/micromark-userlink';
import { fromMarkdown } from 'markdown/userlink/mdast-userlink';
import { add } from 'markdown/utils';

function username() {
  const data = this.data();
  add(data, 'micromarkExtensions', syntax);
  add(data, 'fromMarkdownExtensions', fromMarkdown);
}

export default username;
