import dedupe from '../../es6/d2lfetch-dedupe.js';

var invalidRequestInputs = [
	undefined,
	null,
	1,
	'hello',
	{},
	{ whatiam: 'is not a Request'}
];

var requestMethods = [
	'DELETE',
	'GET',
	'HEAD',
	'OPTIONS',
	'PATCH',
	'POST',
	'PUT'
];

function createSuccessfulResponse() {
	return Promise.resolve(new Response('foo', {
		status: 200
	}));
}

describe('d2l-fetch-dedupe', function() {

	var sandbox;

	function getRequest(path, headers, method, abortController) {
		method = method || 'GET';
		return new Request(path, {
			method: method,
			headers: headers,
			signal: abortController && abortController.signal
		});
	}

	beforeEach(function() {
		sandbox = sinon.sandbox.create();
	});

	afterEach(function() {
		sandbox.restore();
	});

	it('should be a function on the d2lfetch object', function() {
		expect(dedupe instanceof Function).to.equal(true);
	});

	invalidRequestInputs.forEach(function(input) {
		it('should throw a TypeError if it is not passed a Request object', function() {
			return dedupe(input)
				.then((function() { expect.fail(); }), function(err) { expect(err instanceof TypeError).to.equal(true); });
		});
	});

	it('should call the next function if provided', function() {
		var next = sandbox.stub().returns(createSuccessfulResponse());
		return dedupe(getRequest('/path/to/data'), next)
			.then(function() {
				expect(next).to.be.called;
			});
	});

	it('should not call the next function if a matching request exists in flight', function() {
		var firstRequest = getRequest('/path/to/data');
		var firstNext = sandbox.stub().returns(createSuccessfulResponse());
		dedupe(firstRequest, firstNext)
			.then(function() {
				expect(firstNext).to.be.called;
			});

		var secondRequest = getRequest('/path/to/data');
		var secondNext = sandbox.stub().returns(createSuccessfulResponse());
		return dedupe(secondRequest, secondNext)
			.then(function() {
				expect(secondNext).not.to.be.called;
			});
	});

	it('should call the next function if a matching request has completed', function(done) {
		var firstRequest = getRequest('/path/to/data');
		var firstNext = sandbox.stub().returns(createSuccessfulResponse());
		dedupe(firstRequest, firstNext)
			.then(function() {
				expect(firstNext).to.be.called;
				var secondRequest = getRequest('/path/to/data');
				var secondNext = sandbox.stub().returns(createSuccessfulResponse());
				dedupe(secondRequest, secondNext)
				.then(function() {
					expect(secondNext).to.be.called;
					done();
				});
			});
	});

	it('matched responses should be have their bodies cloned so that the body can be requested by each caller', function(done) {
		var matchedResponse = new Response('{ dataprop: \'sweet sweet data\' }', { status: 200, statusText: 'super!' });
		var firstRequest = getRequest('/path/to/data');
		var firstNext = sandbox.stub().returns(Promise.resolve(matchedResponse));
		var secondRequest = getRequest('/path/to/data');
		var secondNext = sandbox.stub().returns(Promise.reject);
		var thirdRequest = getRequest('/path/to/data');
		var thirdNext = sandbox.stub().returns(Promise.reject);

		Promise.all([
			dedupe(firstRequest, firstNext),
			dedupe(secondRequest, secondNext),
			dedupe(thirdRequest, thirdNext)
		]).then(function(responses) {
			// expect the same promises
			expect(responses[0]).to.equal(responses[1]);
			expect(responses[1]).to.equal(responses[2]);
			// body should be used at this point, technically
			expect(responses[0].bodyUsed).to.equal(true);
			Promise.all([
				responses[0].json,
				responses[1].json,
				responses[2].json
			]).then(function(bodies) {
				// expect the same bodies
				expect(bodies[0]).to.equal(bodies[1]);
				expect(bodies[1]).to.equal(bodies[2]);
				expect(bodies[0]).to.equal(bodies[2]);
				done();
			});
		});
	});

	it('unmatched responses should not have their bodies cloned and the body should be read at the time the caller requests it', function(done) {
		var response = new Response('{ dataprop: \'sweet sweet data\' }', { status: 200, statusText: 'super!' });
		var firstRequest = getRequest('/path/to/data');
		var firstNext = sandbox.stub().returns(Promise.resolve(response));
		dedupe(firstRequest, firstNext)
			.then(function(response) {
				expect(firstNext).to.be.called;
				expect(response.bodyUsed).to.equal(false);
				response.text().then(function() {
					expect(response.bodyUsed).to.equal(true);
					done();
				});
			});
	});

	it('should allow calls to blob() for unmatched responses', function(done) {
		var data = JSON.stringify({ dataprop: 'sweet sweet data' });
		var response = new Response(data, { status: 200, statusText: 'super!' });
		var firstRequest = getRequest('/path/to/data');
		var firstNext = sandbox.stub().returns(Promise.resolve(response));
		dedupe(firstRequest, firstNext)
			.then(function(response) {
				response.blob().then(function(blobData) {
					expect(blobData).to.be.defined;
					expect(blobData.size).to.equal(data.length);
					done();
				});
			});
	});

	it('should reject calls to blob() for matched responses', function(done) {
		var matchedResponse = new Response('{ dataprop: \'sweet sweet data\' }', { status: 200, statusText: 'super!' });
		var firstRequest = getRequest('/path/to/data');
		var firstNext = sandbox.stub().returns(Promise.resolve(matchedResponse));
		var secondRequest = getRequest('/path/to/data');
		var secondNext = sandbox.stub().returns(Promise.reject);

		Promise.all([
			dedupe(firstRequest, firstNext),
			dedupe(secondRequest, secondNext)
		]).then(function(responses) {
			responses[0].blob().catch(function(err) {
				expect(err.message).to.equal('dedupe middleware cannot be used with blob response bodies');
				done();
			});
		});
	});

	it('should allow calls to formData() for unmatched responses', function(done) {
		// Edge doesn't support FormData so ignore this test on Edge
		if ((new Response()).formData === undefined) {
			done();
		} else {
			var data = new FormData();
			data.append('dataprop', 'sweet sweet data');
			var response = new Response(data, { status: 200, statusText: 'super!' });
			var firstRequest = getRequest('/path/to/data');
			var firstNext = sandbox.stub().returns(Promise.resolve(response));
			dedupe(firstRequest, firstNext)
				.then(function(response) {
					response.formData().then(function(formData) {
						expect(formData instanceof FormData).to.be.true;
						expect(formData.get('dataprop')).to.equal('sweet sweet data');
						done();
					});
				});
		}
	});

	it('should reject calls to formData() for matched responses', function(done) {
		var matchedResponse = new Response('{ dataprop: \'sweet sweet data\' }', { status: 200, statusText: 'super!' });
		var firstRequest = getRequest('/path/to/data');
		var firstNext = sandbox.stub().returns(Promise.resolve(matchedResponse));
		var secondRequest = getRequest('/path/to/data');
		var secondNext = sandbox.stub().returns(Promise.reject);

		Promise.all([
			dedupe(firstRequest, firstNext),
			dedupe(secondRequest, secondNext)
		]).then(function(responses) {
			responses[0].formData().catch(function(err) {
				expect(err.message).to.equal('dedupe middleware cannot be used with formData response bodies');
				done();
			});
		});
	});

	it('should allow calls to arrayBuffer() for unmatched responses', function(done) {
		var data = window.btoa('sweet sweet data');
		var response = new Response(data, { status: 200, statusText: 'super!' });
		var firstRequest = getRequest('/path/to/data');
		var firstNext = sandbox.stub().returns(Promise.resolve(response));
		dedupe(firstRequest, firstNext)
			.then(function(response) {
				response.arrayBuffer().then(function(arrayBufferData) {
					expect(arrayBufferData instanceof ArrayBuffer).to.be.true;
					expect(window.atob(String.fromCharCode.apply(String, new Uint8Array(arrayBufferData)))).to.equal('sweet sweet data');
					done();
				});
			});
	});

	it('should reject calls to arrayBuffer() for matched responses', function(done) {
		var matchedResponse = new Response('{ dataprop: \'sweet sweet data\' }', { status: 200, statusText: 'super!' });
		var firstRequest = getRequest('/path/to/data');
		var firstNext = sandbox.stub().returns(Promise.resolve(matchedResponse));
		var secondRequest = getRequest('/path/to/data');
		var secondNext = sandbox.stub().returns(Promise.reject);

		Promise.all([
			dedupe(firstRequest, firstNext),
			dedupe(secondRequest, secondNext)
		]).then(function(responses) {
			responses[0].arrayBuffer().catch(function(err) {
				expect(err.message).to.equal('dedupe middleware cannot be used with arrayBuffer response bodies');
				done();
			});
		});
	});

	it('should match two requests if the URLs are the same and they have no Authorization header', function() {
		var firstRequest = getRequest('/path/to/data');
		var firstNext = sandbox.stub().returns(createSuccessfulResponse());
		dedupe(firstRequest, firstNext)
			.then(function() {
				expect(firstNext).to.be.called;
			});

		var secondRequest = getRequest('/path/to/data');
		var secondNext = sandbox.stub().returns(createSuccessfulResponse());
		return dedupe(secondRequest, secondNext)
			.then(function() {
				expect(secondNext).not.to.be.called;
			});
	});

	it('should match two requests if the URLs are the same and they have the same Authorization header', function() {
		var firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
		var firstNext = sandbox.stub().returns(createSuccessfulResponse());
		dedupe(firstRequest, firstNext)
			.then(function() {
				expect(firstNext).to.be.called;
			});

		var secondRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
		var secondNext = sandbox.stub().returns(createSuccessfulResponse());
		return dedupe(secondRequest, secondNext)
			.then(function() {
				expect(secondNext).not.to.be.called;
			});
	});

	it('should not match two requests if the URLs are the same and they have different Authorization headers', function() {
		var firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
		var firstNext = sandbox.stub().returns(createSuccessfulResponse());
		dedupe(firstRequest, firstNext)
			.then(function() {
				expect(firstNext).to.be.called;
			});

		var secondRequest = getRequest('/path/to/data', { Authorization: 'knock-knock' });
		var secondNext = sandbox.stub().returns(createSuccessfulResponse());
		return dedupe(secondRequest, secondNext)
			.then(function() {
				expect(secondNext).to.be.called;
			});
	});

	it('should not match two requests if the URLs are different and they have no Authorization header', function() {
		var firstRequest = getRequest('/path/to/data');
		var firstNext = sandbox.stub().returns(createSuccessfulResponse());
		dedupe(firstRequest, firstNext)
			.then(function() {
				expect(firstNext).to.be.called;
			});

		var secondRequest = getRequest('/different/path/to/data');
		var secondNext = sandbox.stub().returns(createSuccessfulResponse());
		return dedupe(secondRequest, secondNext)
			.then(function() {
				expect(secondNext).to.be.called;
			});
	});

	it('should not match two requests if the URLs are different and they have the same Authorization header', function() {
		var firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
		var firstNext = sandbox.stub().returns(createSuccessfulResponse());
		dedupe(firstRequest, firstNext)
			.then(function() {
				expect(firstNext).to.be.called;
			});

		var secondRequest = getRequest('/different/path/to/data', { Authorization: 'let-me-in' });
		var secondNext = sandbox.stub().returns(createSuccessfulResponse());
		return dedupe(secondRequest, secondNext)
			.then(function() {
				expect(secondNext).to.be.called;
			});
	});

	it('should abort downstream request if only remaining upstream request was aborted', function(done) {
		var abortController = new AbortController();
		var doneConditions = {
			downstreamReqAborted: false,
			upstreamReqAborted: false
		};

		var updateDoneConditions = (newConds) => {
			doneConditions = Object.assign(doneConditions, newConds);

			if (Object.values(doneConditions).every(c => !!c)) {
				done();
			}
		};

		var firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' }, 'GET', abortController);
		var firstNext = req => {
			if (req.signal.aborted) {
				updateDoneConditions({ downstreamReqAborted: true });

				return;
			}

			let rejectDownstreamReq;

			// As we don't have a real fetch to abort, listen for aborts on the
			// downstream request and reject the downstream middleware promise
			const fetchPromise = new Promise((_, reject) => {
				rejectDownstreamReq = reject;
			});

			req.signal.addEventListener('abort', () => {
				rejectDownstreamReq(new DOMException('Request aborted', 'AbortError'));

				updateDoneConditions({ downstreamReqAborted: true });
			});

			return fetchPromise;
		};

		dedupe(firstRequest, firstNext)
			.catch(function(err) {
				expect(err.message).to.equal('Request was aborted.');

				updateDoneConditions({ upstreamReqAborted: true });
			});

		abortController.abort();
	});

	it('should not abort downstream request if not all upstream requests were aborted', function(done) {
		var abortController = new AbortController();
		var successConditions = {
			downstreamReqAborted: false,
			firstUpstreamReqAborted: true,
			secondUpstreamReqAborted: true,
			thirdUpstreamReqAborted: false
		};

		var doneConditions = {
			downstreamReqAborted: false,
			firstUpstreamReqAborted: false,
			secondUpstreamReqAborted: false,
			thirdUpstreamReqAborted: false
		};

		var updateDoneConditions = (newConds) => {
			doneConditions = Object.assign(doneConditions, newConds);
		};

		var fetchResolver;

		var firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' }, 'GET', abortController);
		var secondRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' }, 'GET', abortController);
		var thirdRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' }, 'GET');

		var firstNext = req => {
			if (req.signal.aborted) {
				updateDoneConditions({ downstreamReqAborted: true });

				return;
			}

			let rejectDownstreamReq;

			// As we don't have a real fetch to abort, listen for aborts on the
			// downstream request and reject the downstream middleware promise
			const fetchPromise = new Promise((resolve, reject) => {
				fetchResolver = resolve;
				rejectDownstreamReq = reject;
			});

			req.signal.addEventListener('abort', () => {
				rejectDownstreamReq(new DOMException('Request aborted', 'AbortError'));

				updateDoneConditions({ downstreamReqAborted: true });
			});

			return fetchPromise;
		};

		var secondNext = sinon.stub().returns(Promise.reject());
		var thirdNext = sinon.stub().returns(Promise.reject());

		dedupe(firstRequest, firstNext)
			.catch(function(err) {
				expect(err.message).to.equal('Request was aborted.');

				updateDoneConditions({ firstUpstreamReqAborted: true });
			});

		dedupe(secondRequest, secondNext)
			.catch(function(err) {
				expect(secondNext).not.to.be.called;
				expect(err.message).to.equal('Request was aborted.');

				updateDoneConditions({ secondUpstreamReqAborted: true });
			});

		dedupe(thirdRequest, thirdNext)
			.catch(function() {
				expect(thirdNext).not.to.be.called;

				updateDoneConditions({ thirdUpstreamReqAborted: true });
			});

		abortController.abort();

		setTimeout(() => {
			fetchResolver();

			expect(successConditions).to.deep.equal(doneConditions);

			done();
		});
	});

	it('should release request promises that were rejected', function(done) {
		var firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
		var firstNext = sandbox.stub().returns(Promise.reject(new Error()));
		var secondRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
		var secondNext = sandbox.stub().returns(createSuccessfulResponse());

		dedupe(firstRequest, firstNext)
			.catch(function() {
				return dedupe(secondRequest, secondNext);
			})
			.then(function() {
				expect(secondNext).to.be.called;
				done();
			});
	});

	requestMethods.forEach(function(method) {
		it('should not match two requests if the URLs are the same, the authorization header is the same, but they are not GET, HEAD, or OPTIONS requests', function() {
			var firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' }, method);
			var firstNext = sandbox.stub().returns(createSuccessfulResponse());
			dedupe(firstRequest, firstNext)
				.then(function() {
					expect(firstNext).to.be.called;
				});

			var secondRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' }, method);
			var secondNext = sandbox.stub().returns(createSuccessfulResponse());
			return dedupe(secondRequest, secondNext)
				.then(function() {
					if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
						expect(secondNext).not.to.be.called;
					} else {
						expect(secondNext).to.be.called;
					}
				});
		});
	});
});
