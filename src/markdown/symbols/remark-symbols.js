import syntax from './micromark-extension-symbols';
import { fromMarkdown } from './mdast-extension-symbols'
import { add } from '../utils';

export default symbols;

function symbols(options) {
    if (!options.allowed) {
        console.warn(
            '[remark-symbols] Warning: no symbols specified!'
        );
    }

    const data = this.data();
    const valid = options.allowed || '';
    add(data, 'micromarkExtensions', syntax(valid));
    add(data, 'fromMarkdownExtensions', fromMarkdown);
}