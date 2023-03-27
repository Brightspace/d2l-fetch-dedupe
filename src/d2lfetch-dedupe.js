/**
 * @typedef {(request: Request) => Promise<Response>} MiddlewareFunc
 * @typedef {Parameters<ConstructorParameters<typeof Promise>[0]>} PromiseCallbackParams
 * @typedef {{resolve: PromiseCallbackParams[0]; reject: PromiseCallbackParams[1]}} Resolvers
 * @typedef {{reqId: number; resolvers: Resolvers; removeAbortListener?: Function}} DeduplicatedRequest
 *
 * @typedef {object} InflightRequestEntry
 * @prop {Request} inflightRequest
 * @prop {AbortController | undefined} abortController
 * @prop {DeduplicatedRequest[]} dedupedRequests
 * @prop {number} nextReqId
 *
 * @typedef {Record<string, InflightRequestEntry>} InflightRequestInfo
 */

export class D2LFetchDedupe {

	constructor() {
		/** @type {InflightRequestInfo} */
		this._inflightRequests = {};
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

		let newRequest = false;

		if (!this._inflightRequests[key]) {
			const abortController = request.signal
				&& typeof request.signal.addEventListener === 'function'
				&& window.AbortController ? new AbortController() : undefined;

			const inflightRequest = new Request(request, {
				signal: abortController ? abortController.signal : undefined
			});

			this._inflightRequests[key] = {
				inflightRequest,
				abortController,
				dedupedRequests: [],
				nextReqId: 0
			};

			newRequest = true;
		}

		const dedupedRequest = new Promise((resolve, reject) => {
			const inflightRequestEntry = this._inflightRequests[key];
			const reqId = inflightRequestEntry.nextReqId++;
			/** @type {DeduplicatedRequest} */
			const newDedupedRequest = {
				resolvers: { resolve, reject },
				reqId
			};

			inflightRequestEntry.dedupedRequests.push(newDedupedRequest);

			if (request.signal) {
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

						const dedupedReqIndex = inflightRequestEntry.dedupedRequests.findIndex(r => r.reqId === reqId);
						if (dedupedReqIndex < 0) {
							return;
						}

						inflightRequestEntry.dedupedRequests.splice(dedupedReqIndex, 1);

						if (inflightRequestEntry.dedupedRequests.length === 0 && inflightRequestEntry.abortController) {
							inflightRequestEntry.abortController.abort();
						}
						reject(new DOMException('Request was aborted.', 'AbortError'));
					};

					newDedupedRequest.removeAbortListener = () => signal.removeEventListener('abort', handler);
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
				const dedupedRequests = this._inflightRequests[key].dedupedRequests;
				delete this._inflightRequests[key];

				const res = dedupedRequests.length > 1
					? this._clone(response)
					: response;

				for (const dedupedRequest of dedupedRequests) {
					if (typeof dedupedRequest.removeAbortListener === 'function') {
						dedupedRequest.removeAbortListener();
					}
					dedupedRequest.resolvers.resolve(res);
				}
			}, (err) => {
				const dedupedRequests = this._inflightRequests[key].dedupedRequests;
				delete this._inflightRequests[key];

				for (const dedupedRequest of dedupedRequests) {
					if (typeof dedupedRequest.removeAbortListener === 'function') {
						dedupedRequest.removeAbortListener();
					}
					dedupedRequest.resolvers.reject(err);
				}
			});

		return dedupedRequest;
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
			.then((textData) => {
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

	/**
	 * @param {Request} request
	 */
	_getKey(request) {
		if (request.headers.has('Authorization')) {
			return request.url + request.headers.get('Authorization');
		}

		return request.url;
	}

	_reset() {
		this._inflightRequests = [];
	}
}
