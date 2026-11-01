/**
 * jsdom implements no Web Animations API, so Headless UI installs its own
 * `Element.prototype.getAnimations` polyfill the first time `use-transition` is imported under
 * NODE_ENV=test — and that polyfill logs a `console.warn` for every element it is called on,
 * which any test that drives a real open/close transition would fill the output with.
 *
 * Installing the same stub first suppresses that, because Headless UI only polyfills when the
 * method is missing. Returning an empty list is the whole contract the library needs: it filters
 * the result for `CSSTransition` instances and treats "none" as "the transition is already done",
 * so transitions resolve on the next frame instead of hanging.
 *
 * Import this module *before* anything that pulls in `@headlessui/react`; ES imports evaluate in
 * order, so the stub has to come first to win the race against the polyfill.
 */
if (typeof Element !== 'undefined' && typeof Element.prototype.getAnimations === 'undefined') {
  Element.prototype.getAnimations = () => [];
}

export {};
