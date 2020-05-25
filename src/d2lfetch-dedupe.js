/**
 * @typedef {(request: Request) => Promise<Response>} MiddlewareFunc
 * @typedef {Parameters<ConstructorParameters<typeof Promise>[0]>} PromiseCallbackParams
 * @typedef {{resolve: PromiseCallbackParams[0]; reject: PromiseCallbackParams[1]}} Resolvers
 * @typedef {{resolvers: Resolvers, removeAbortListener?: Function}} DeduplicatedRequest
 *
 * @typedef {object} InflightRequestEntry
 * @prop {Request} inflightRequest
 * @prop {AbortController | null} abortController
 * @prop {Record<string, DeduplicatedRequest>} dedupedRequests
 *
 * @typedef {Record<string, InflightRequestEntry>} InflightRequestInfo
 */

export class D2LFetchDedupe {

	constructor() {
		/** @type {InflightRequestInfo} */
		this._inflightRequests = {};
		this._nextReqId = 0;
	}

	/**
	 * @param {Request} request
	 * @param {MiddlewareFunc} next
	 *
	 * @returns {Promise<Response>}
	 */
	dedupe(request, next) {
		if (false === request instanceof Request) {
			return Promise.reject(new TypeError('Invalid request argument supplied; must be a valid window.Request object.'));
		}

		if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS') {
			return next(request);
		}

		const key = this._getKey(request);
		const reqId = this._nextReqId++;

		let newRequest = false;

		if (!this._inflightRequests[key]) {
			const abortController = window.AbortController
				? new AbortController()
				: null;

			const inflightRequest = new Request(request, {
				signal: (abortController || {}).signal
			});

			this._inflightRequests[key] = {
				inflightRequest,
				abortController,
				dedupedRequests: {}
			};

			newRequest = true;
		}

		const dedupedRequest = new Promise((resolve, reject) => {
			const inflightRequestEntry = this._inflightRequests[key];

			inflightRequestEntry.dedupedRequests[reqId] = {
				resolvers: { resolve, reject }
			};

			if (request.signal && typeof request.signal.addEventListener === 'function') {
				/**
				 * @param {AbortSignal} signal
				 * @param {string} key
				 * @param {number} reqId
				 */
				const addAbortEventListener = (signal, key, reqId) => {
					const handler = () => {
						signal.removeEventListener('abort', handler);

						const inflightRequestEntry = this._inflightRequests[key];

						if (!inflightRequestEntry) {
							return;
						}

						if (Object.keys(inflightRequestEntry.dedupedRequests).length === 1) {
							const abortController = inflightRequestEntry.abortController;

							if (abortController && typeof abortController.abort === 'function') {
								abortController.abort();
							}
						}

						delete inflightRequestEntry.dedupedRequests[reqId];
						reject(new DOMException('Request was aborted.', 'AbortError'));
					};

					inflightRequestEntry.dedupedRequests[reqId].removeAbortListener = () => signal.removeEventListener('abort', handler);
					signal.addEventListener('abort', handler);
				};

				addAbortEventListener(request.signal, key, reqId);
			}
		});

		if (!newRequest) {
			return dedupedRequest;
		}

		next(this._inflightRequests[key].inflightRequest)
			.then((response) => {
				const dedupedRequests = Object.values(this._inflightRequests[key].dedupedRequests);
				const res = dedupedRequests.length > 1
					? this._clone(response)
					: response;

				for (const dedupedRequest of dedupedRequests) {
					if (typeof dedupedRequest.removeAbortListener === 'function') {
						dedupedRequest.removeAbortListener();
					}
					dedupedRequest.resolvers.resolve(res);
				}

				delete this._inflightRequests[key];
			})
			.catch((err) => {
				for (const dedupedRequest of Object.values(this._inflightRequests[key].dedupedRequests)) {
					if (typeof dedupedRequest.removeAbortListener === 'function') {
						dedupedRequest.removeAbortListener();
					}
					dedupedRequest.resolvers.reject(err);
				}

				delete this._inflightRequests[key];
			});

		return dedupedRequest;
	}

	/**
	 * @param {Request} request
	 */
	_getKey(request) {
		if (request.headers.has('Authorization')) {
			return request.url + request.headers.get('Authorization');
		}

		return request.url;
	}

	/**
	 * @param {Response} response
	 */
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
