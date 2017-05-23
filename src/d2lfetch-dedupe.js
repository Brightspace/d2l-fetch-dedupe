export class D2LFetchDedupe {

	constructor() {
		this._inflightRequests = [];
	}

	dedupe(request, next) {
		if (false === request instanceof Request) {
			return Promise.reject(new TypeError('Invalid request argument supplied; must be a valid window.Request object.'));
		}

		const key = this._getKey(request);
		if (this._inflightRequests[key]) {
			return this._clone(this._inflightRequests[key]);
		}

		if (!next) {
			return request;
		}

		const result = next(request);
		if (result && result instanceof Promise) {
			this._inflightRequests[key] = result;
			result.then(() => {
				delete this._inflightRequests[key];
			});
		}

		return this._clone(result);
	}

	_getKey(request) {
		if (request.headers.has('Authorization')) {
			return request.url + request.headers.get('Authorization');
		}

		return request.url;
	}

	_clone(result) {
		return result.then(function(response) {
			if (response instanceof Response) {
				return response.clone();
			}
		});
	}
}
