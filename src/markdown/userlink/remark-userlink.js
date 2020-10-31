import syntax from './micromark-extension-userlink';
import { fromMarkdown } from './mdast-extension-userlink';
import { add } from '../utils';

export default username;

function username() {
  const data = this.data();
  add(data, 'micromarkExtensions', syntax);
  add(data, 'fromMarkdownExtensions', fromMarkdown);
}
