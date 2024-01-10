# d2l-fetch-dedupe
Provides a middleware function for de-duplicating fetch requests for the same url+auth combination

## Setup

```sh
npm ci
```

## Usage

Reference the script in your html after your reference to `d2l-fetch` (see [here](https://github.com/Brightspace/d2l-fetch) for details on d2l-fetch):

Install `d2l-fetch-dedupe` via npm:
```sh
npm install d2l-fetch-dedupe
```

```javascript
import { fetchDedupe } from 'd2l-fetch-dedupe';
```

This will import the `auth` middleware

### Dedupe

Install the `dedupe` middleware to d2lfetch via the `use` function and then start making your requests.

```js
d2lfetch.use({name: 'dedupe' fn: fetchDedupe});
const response = await d2lfetch.fetch(
  new Request('http://example.com/api/someentity/')
);
```

Requests are deduped based on the combination of `url` and `Authorization` request header value.
Any request that matches an existing in-flight request based on this combination will not result
in a subsequent network request but will rather be given a promise that resolves to a clone of
the inflight request's Response.

## Versioning and Releasing

This repo is configured to use `semantic-release`. Commits prefixed with `fix:` and `feat:` will trigger patch and minor releases when merged to `main`.

To learn how to create major releases and release from maintenance branches, refer to the [semantic-release GitHub Action](https://github.com/BrightspaceUI/actions/tree/main/semantic-release) documentation.
