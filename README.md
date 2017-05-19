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

This creates files in the `/dist/` directory ready for consumption.

## Usage

Reference the script in your html:

```html
<script src="../dist/d2lfetch.js"></script>
```

This will add a `d2lfetch` object to the global scope, with two methods: `use` and `fetch`.

### Use

Use the 'use' function to append functions to the middleware chain. These functions will be executed in the order they are 'use'd.

Each middleware function will be passed two parameters: a Request object and the next function in the middleware to be executed. Unless
you wish to exit the chain early your middleware should execute the next function during its own execution and return the result.

Example:

```js
var myMiddlewareFunc = (request, next) => {
	// Do something with the request, like maybe add a custom header
	request.headers.set('X-My-Custom-Header', 'hello');

	// Continue to the next function in the chain
	var response = next(request);

	// If you want you can do something with the response now, or not, up to you
	// in this example we'll just return it back up the chain

	return response;
};

window.d2lfetch.use(myMiddlewareFunc);
```

If you do wish to exit the chain early no further middleware will be executed, nor will the `window.fetch` call. You should return a Promise with
your desired output (keep in mind that callers are probably expecting it to contain a [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)).

Example:

```js
var myEarlyExitFunc = (request, next) => {
	// Check if we have a cached response for this request
	if (CACHED_RESPONSES[request.url]) {
		// Return what we have, this will skip further
		// middleware functions as well as the `window.fetch` call
		return Promise.resolve(CACHED_RESPONSES[request.url]);
	}

	// We've got nothing so continue to the next function in the chain
	return next(request);
};

window.d2lfetch.use(myEarlyExitFunc);
window.d2lfetch.use(myMiddlewareFunc); // this may never get called
```

### Fetch

Use the `fetch` function to execute the middleware chain followed by a [`window.fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) call. Returns the `Promise` result of the `window.fetch` call or whatever result was returned by any middleware that exited early from the chain.

Example:

```js
window.d2lfetch.use(myMiddlewareFunc);

window.d2lfetch.fetch(new Request('http://www.example.com/api/stuff'))
	.then(function(response) {
		// do something with the response
	})
	.catch(function(reason) {
		console.log(reason);
	});
```

## Browser compatibility

`d2l-fetch` makes use of two javascript features that are not yet fully supported across all modern browsers: the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) and [Promises](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise). If you need to support browsers that do not yet implement these features you will need to include polyfills for this functionality.

We recommend:

* [fetch](https://github.com/github/fetch)
* [promise-polyfill](https://github.com/PolymerLabs/promise-polyfill/)
