# d2l-fetch-dedupe
Provides a middleware function for de-duplicating fetch requests for the same url+auth combination

## Setup

```sh
npm ci
```

## Build

```sh
npm run build
```

## Usage

Reference the script in your html after your reference to `d2l-fetch` (see [here](https://github.com/Brightspace/d2l-fetch) for details on d2l-fetch):

Install `d2l-fetch-dedupe` via npm:
```sh
npm install d2l-fetch-dedupe
```

```javascript
import dedupe from 'd2l-fetch-dedupe';
```

This will import the `auth` middleware

### Dedupe

Install the `dedupe` middleware to d2lfetch via the `use` function and then start making your requests.

```js
d2lfetch.use({name: 'dedupe' fn: dedupe});

d2lfetch.fetch(new Request('http://example.com/api/someentity/'))
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

## Publishing

The application will automatically increment the minor build version and publish a release version to the Brightspace CDN after merge to the `master` branch is complete. If you wish to increment the `patch` or `major` version instead please add **[increment patch]** or **[increment major]** to the notes inside your merge message.
