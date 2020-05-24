/**
 * @typedef {(request: Request, next?: MiddlewareFunc) => Promise<Response>} MiddlewareFunc
 *
 * @typedef {object} InflightSourceRequest
 * @prop {Request} request
 * @prop {{resolve: Function, reject: Function}} resolvers
 *
 * @typedef {object} InflightRequestEntry
 * @prop {Request} request
 * @prop {AbortController} [abortController]
 * @prop {Record<string, InflightSourceRequest>} sourceRequests
 *
 * @typedef {Record<string, InflightRequestEntry>} InflightRequestInfo
 */

export class D2LFetchDedupe {

	constructor() {
		this._nextReqId = 0;
		/** @type {InflightRequestInfo} */
		this._inflightRequests = this._inflightRequests || {};
	}

	/**
	 * @param {Request} request
	 * @param {MiddlewareFunc} next
	 */
	dedupe(request, next) {
		if (false === request instanceof Request) {
			return Promise.reject(new TypeError('Invalid request argument supplied; must be a valid window.Request object.'));
		}

		if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS') {
			if (!next) {
				return Promise.resolve(request);
			}
			return next(request);
		}

		const key = this._getKey(request);
		const reqId = this._nextReqId++;

		let newRequest = false;

		// if this is the first request for this key,
		// clone the upstream request and pass to downstream middleware
		if (!this._inflightRequests[key]) {
			const abortController = new AbortController();

			const requestCopy = new Request(request.url, {
				method: request.method,
				headers: new Headers(request.headers),
				mode: request.mode,
				cache: request.cache,
				credentials: request.credentials,
				keepalive: request.keepalive,
				integrity: request.integrity,
				redirect: request.redirect,
				referrer: request.referrer,
				referrerPolicy: request.referrerPolicy,
				signal: abortController.signal
			});

			this._inflightRequests[key] = {
				request: requestCopy,
				abortController,
				sourceRequests: {}
			};

			newRequest = true;
		}

		const dedupedRequest = new Promise((resolve, reject) => {
			this._inflightRequests[key].sourceRequests[reqId] = {
				request,
				resolvers: {
					resolve,
					reject
				}
			};

			// Aborting a request will cause the upstream promise to be rejected and removed from
			// the sourceRequests set, but will not cause the downstream request to be aborted
			// unless there are no other upstream requests mapped to it.
			if (request.signal && typeof request.signal.addEventListener === 'function') {
				request.signal.addEventListener('abort', () => {
					const inflightRequest = this._inflightRequests[key];

					if (Object.keys(inflightRequest.sourceRequests).length === 1) {
						const abortController = this._inflightRequests[key].abortController;

						if (abortController && typeof abortController.abort === 'function') {
							abortController.abort();
						}
					}

					delete inflightRequest.sourceRequests[reqId];

					const abortError = new DOMException('Request was aborted.', 'AbortError');

					reject(abortError);
				});
			}
		});

		// If an inflight request exists for this key, return the deduped request.
		if (!newRequest) {
			return dedupedRequest;
		}

		// No existing inflight request exists, so pass the canonical request downstream
		const result = next(this._inflightRequests[key].request);

		this._inflightRequests[key].action = result
			.then((response) => {
				const sourceRequests = Object.values(this._inflightRequests[key].sourceRequests);

				const res = sourceRequests.length > 1
					? this._clone(response)
					: response;

				for (const sourceRequest of sourceRequests) {
					sourceRequest.resolvers.resolve(res);
				}

				delete this._inflightRequests[key];
			})
			.catch((err) => {
				if (!this._inflightRequests[key]) {
					return;
				}

				for (const sourceRequest of Object.values(this._inflightRequests[key].sourceRequests)) {
					sourceRequest.resolvers.reject(err);
				}

				delete this._inflightRequests[key];
			});

		return dedupedRequest;
	}

	_getKey(request) {
		if (request.headers.has('Authorization')) {
			return request.url + request.headers.get('Authorization');
		}

		return request.url;
	}

	_clone(response) {
		// body can only be read once, override the functions
		// so that they return the output of the original call

		// NOTE: This is pretty hacky but unfortunately the native
		// 	     response.clone() method can lead to sporadic
		//		 "Cannot clone a disturbed response" errors in Safari.
		//		 See https://github.com/Brightspace/d2l-fetch-dedupe/pull/13 for more details.
		return response.text()
			.then(function(textData) {
				response.json = function() {
					return Promise.resolve(JSON.parse(textData));
				};
				response.text = function() {
					return Promise.resolve(textData);
				};
				response.arrayBuffer = function() {
					return Promise.reject(new Error('dedupe middleware cannot be used with arrayBuffer response bodies'));
				};
				response.blob = function() {
					return Promise.reject(new Error('dedupe middleware cannot be used with blob response bodies'));
				};
				response.formData = function() {
					return Promise.reject(new Error('dedupe middleware cannot be used with formData response bodies'));
				};

				return response;
			});
	}
}
