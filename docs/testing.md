# Testing

## Frontend testing

When it comes to manually testing Frontend components, the key areas of focus are:

1. Test in both Desktop and Mobile browsers (browser dev tools helps a lot here). Doubly important when the UI contains any responsive aspects
2. Test in multiple modern browsers (both desktop and mobile)
3. Compare and contrast (with screenshots/videos) the before and after UI differences to include in the PR

### Accessibility

It would also be ideal to test with accessibility in mind such as keyboard navigation, though CubeCobra doesn't have standards for that at this time.

One easy accessibility aspect to keep in mind when dealing with foreground text vs background colors, and ensuring there is enough contrast. A tool such as the [Web Accessibility in Mind constrast checker](https://webaim.org/resources/contrastchecker/) makes it easy to validate the foreground/background colors meet at least the AA standard.

## Unit tests

Unit tests are written via Jest. See [Tests Readme](../tests/README.md) for more details about how the Unit tests are organized.

In the ideal world business logic within frontend Components (eg .tsx files) would be separated from the UI components themselves, for separation of concerns and easier focus of unit testing each part.
