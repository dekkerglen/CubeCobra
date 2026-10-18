import { isValidElement, ReactNode } from 'react';

/**
 * Flattens a React node to its plain text content.
 *
 * Replaces the `react-to-text` package, which is unmaintained and declares a React ^18.2.0
 * peer dependency. Keeping it would have held a second copy of React 18 in the dependency
 * tree alongside React 19, which risks the "invalid hook call" duplicate-React failure.
 *
 * Behaviour matches the single way the package was used here (no custom resolvers):
 * strings, numbers and booleans stringify, arrays concatenate, elements recurse into
 * their children, and anything else resolves to an empty string.
 */
const reactNodeToText = (node: ReactNode): string => {
  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
    return node.toString();
  }

  if (!node) {
    return '';
  }

  if (Array.isArray(node)) {
    return node.map(reactNodeToText).join('');
  }

  const children = isValidElement<{ children?: ReactNode }>(node) ? node.props.children : undefined;

  return children ? reactNodeToText(children) : '';
};

export default reactNodeToText;
