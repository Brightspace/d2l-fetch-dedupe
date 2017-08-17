export class D2LFetchDedupe {

	constructor() {
		this._inflightRequests = this._inflightRequests || [];
	}

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
		if (this._inflightRequests[key]) {
			this._inflightRequests[key].count++;
			return this._inflightRequests[key].action;
		}

		if (!next) {
			return Promise.resolve(request);
		}

		const result = next(request);
		if (result && result instanceof Promise) {
			this._inflightRequests[key] = { count: 1 };
			this._inflightRequests[key].action = result.then(function(response) {
				const usedMultiple = this._inflightRequests[key].count !== 1;
				delete this._inflightRequests[key];
				return this._clone(response, usedMultiple);
			}.bind(this));

			return this._inflightRequests[key].action;
		}

		return result;
	}

	_getKey(request) {
		if (request.headers.has('Authorization')) {
			return request.url + request.headers.get('Authorization');
		}

		return request.url;
	}

	_clone(response, usedMultiple) {
		if (!usedMultiple || response instanceof Response === false) {
			// no calls matched, don't need to clone
			return Promise.resolve(response);
		}

		// body can only be read once, override the functions
		// so that they return the output of the original call
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
