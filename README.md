# d2l-fetch-dedupe
Provides a middleware function for de-duplicating fetch requests for the same url+auth combination

## Browser compatibility

`d2l-fetch-dedupe` makes use of a javascript feature that are is yet fully supported across all modern browsers: [Promises](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise). If you need to support browsers that do not yet implement this feature you will need to include polyfills for this functionality.

We recommend:

* [promise-polyfill](https://github.com/PolymerLabs/promise-polyfill/)
