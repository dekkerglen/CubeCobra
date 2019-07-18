# srcset [![Build Status](https://travis-ci.org/sindresorhus/srcset.svg?branch=master)](https://travis-ci.org/sindresorhus/srcset)

> Parse and stringify the HTML `<img>` [srcset](https://www.smashingmagazine.com/2013/08/webkit-implements-srcset-and-why-its-a-good-thing/) attribute.

Useful if you're creating a polyfill, build-tool, etc.


## Install

```
$ npm install srcset
```


## Usage

How an image with `srcset` might look like:

```html
<img alt="The Breakfast Combo"
     src="banner.jpg"
     srcset="banner-HD.jpg 2x, banner-phone.jpg 100w, banner-phone-HD.jpg 100w 2x">
```

Then have some fun with it:

```js
const srcset = require('srcset');

const parsed = srcset.parse('banner-HD.jpg 2x, banner-phone.jpg 100w');
console.log(parsed);
/*
[
	{
		url: 'banner-HD.jpg',
		density: 2
	},
	{
		url: 'banner-phone.jpg',
		width: 100
	}
]
*/

parsed.push({
	url: 'banner-phone-HD.jpg',
	width: 100,
	density: 2
});

const stringified = srcset.stringify(parsed);
console.log(stringified);
/*
banner-HD.jpg 2x, banner-phone.jpg 100w, banner-phone-HD.jpg 100w 2x
*/
```


## API

### .parse()

Accepts a srcset string and returns an array of objects with the possible properties: `url` (always), `width`, `height`, `density`.

### .stringify()

Accepts an array of objects with the possible properties: `url` (required), `width`, `height`, `density` and returns a srcset string.


## License

MIT © [Sindre Sorhus](https://sindresorhus.com)
