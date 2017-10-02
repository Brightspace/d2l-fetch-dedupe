# d2l-fetch-dedupe
Provides a middleware function for de-duplicating fetch requests for the same url+auth combination

## Setup

```sh
yarn install
```

## Build

```sh
npm run build
```

## Usage

Reference the script in your html after your reference to `d2l-fetch` (see [here](https://github.com/Brightspace/d2l-fetch) for details on d2l-fetch):

```html
<script src="https://s.brightspace.com/lib/d2lfetch/1.0.0/d2lfetch.js"></script>
<script src="../dist/d2lfetch-dedupe.js"></script>
```

This will add the `dedupe` middleware function to the `d2lfetch` object. Alternatively, you can install `d2l-fetch-dedupe` via bower:

```sh
bower install Brightspace/d2l-fetch-dedupe
```

and reference it as you would any other package:

```html
<link rel="import" href="../d2l-fetch-dedupe/d2l-fetch-dedupe.html">
```

Note that this version of `d2l-fetch-dedupe` is not transpiled - doing so is left up to the consumer.

### Dedupe

Install the `dedupe` middleware to d2lfetch via the `use` function and then start making your requests.

```js
window.d2lfetch.use({name: 'dedupe' fn: window.d2lfetch.dedupe});

window.d2lfetch.fetch(new Request('http://example.com/api/someentity/'))
	.then(function(response) {
		// do something with the response
	});
```

Requests are deduped based on the combination of `url` and `Authorization` request header value.
Any request that matches an existing in-flight request based on this combination will not result
in a subsequent network request but will rather be given a promise that resolves to a clone of
the inflight request's Response.

## Browser compatibility

`d2l-fetch-dedupe` makes use of a javascript feature that is not yet fully supported across all modern browsers: [Promises](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise). If you need to support browsers that do not yet implement this feature you will need to include polyfills for this functionality.

We recommend:

* [promise-polyfill](https://github.com/PolymerLabs/promise-polyfill/)
