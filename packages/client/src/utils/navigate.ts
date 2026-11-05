/**
 * Leave the current page for `url`.
 *
 * A function rather than `window.location.href = ...` at the call site purely so it can be
 * stood in for: jsdom's `location` is neither configurable nor writable, so a component that
 * assigns to it directly cannot be tested for where it sends the user.
 */
export const navigateTo = (url: string): void => {
  window.location.href = url;
};
