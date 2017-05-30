'use strict';

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

describe('d2l-fetch-dedupe', function() {

	var sandbox;

	function getRequest(path, headers, method) {
		method = method || 'GET';
		return new Request(path, { method: method, headers: headers });
	}

	beforeEach(function() {
		sandbox = sinon.sandbox.create();
	});

	afterEach(function() {
		sandbox.restore();
	});

	it('should create the d2lfetch object if it doesn\'t exist', function() {
		expect(window.d2lfetch).to.be.defined;
	});

	it('should be a function on the d2lfetch object', function() {
		expect(window.d2lfetch.dedupe instanceof Function).to.equal(true);
	});

	invalidRequestInputs.forEach(function(input) {
		it('should throw a TypeError if it is not passed a Request object', function() {
			return window.d2lfetch.dedupe(input)
				.then((function() { expect.fail(); }), function(err) { expect(err instanceof TypeError).to.equal(true); });
		});
	});

	it('should call the next function if provided', function() {
		var next = sandbox.stub().returns(Promise.resolve());
		return window.d2lfetch.dedupe(getRequest('/path/to/data'), next)
			.then(function() {
				expect(next).to.be.called;
			});
	});

	it('should not call the next function if a matching request exists in flight', function() {
		var firstRequest = getRequest('/path/to/data');
		var firstNext = sandbox.stub().returns(Promise.resolve());
		window.d2lfetch.dedupe(firstRequest, firstNext)
			.then(function() {
				expect(firstNext).to.be.called;
			});

		var secondRequest = getRequest('/path/to/data');
		var secondNext = sandbox.stub().returns(Promise.resolve());
		return window.d2lfetch.dedupe(secondRequest, secondNext)
			.then(function() {
				expect(secondNext).not.to.be.called;
			});
	});

	it('should call the next function if a matching request has completed', function(done) {
		var firstRequest = getRequest('/path/to/data');
		var firstNext = sandbox.stub().returns(Promise.resolve());
		window.d2lfetch.dedupe(firstRequest, firstNext)
			.then(function() {
				expect(firstNext).to.be.called;
				var secondRequest = getRequest('/path/to/data');
				var secondNext = sandbox.stub().returns(Promise.resolve());
				window.d2lfetch.dedupe(secondRequest, secondNext)
				.then(function() {
					expect(secondNext).to.be.called;
					done();
				});
			});
	});

	it('matched responses should be cloned so that the body can be requested by each caller', function(done) {
		var matchedResponse = new Response('{ dataprop: \'sweet sweet data\' }', { status: 200, statusText: 'super!' });
		var firstRequest = getRequest('/path/to/data');
		var firstNext = sandbox.stub().returns(Promise.resolve(matchedResponse));
		var secondRequest = getRequest('/path/to/data');
		var secondNext = sandbox.stub().returns(Promise.reject);
		var thirdRequest = getRequest('/path/to/data');
		var thirdNext = sandbox.stub().returns(Promise.reject);

		Promise.all([
			window.d2lfetch.dedupe(firstRequest, firstNext),
			window.d2lfetch.dedupe(secondRequest, secondNext),
			window.d2lfetch.dedupe(thirdRequest, thirdNext)
		]).then(function(responses) {
			// expect different promises
			expect(responses[0]).not.to.equal(responses[1]);
			expect(responses[1]).not.to.equal(responses[2]);
			expect(responses[0]).not.to.equal(responses[2]);
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

	it('should match two requests if the URLs are the same and they have no Authorization header', function() {
		var firstRequest = getRequest('/path/to/data');
		var firstNext = sandbox.stub().returns(Promise.resolve());
		window.d2lfetch.dedupe(firstRequest, firstNext)
			.then(function() {
				expect(firstNext).to.be.called;
			});

		var secondRequest = getRequest('/path/to/data');
		var secondNext = sandbox.stub().returns(Promise.resolve());
		return window.d2lfetch.dedupe(secondRequest, secondNext)
			.then(function() {
				expect(secondNext).not.to.be.called;
			});
	});

	it('should match two requests if the URLs are the same and they have the same Authorization header', function() {
		var firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
		var firstNext = sandbox.stub().returns(Promise.resolve());
		window.d2lfetch.dedupe(firstRequest, firstNext)
			.then(function() {
				expect(firstNext).to.be.called;
			});

		var secondRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
		var secondNext = sandbox.stub().returns(Promise.resolve());
		return window.d2lfetch.dedupe(secondRequest, secondNext)
			.then(function() {
				expect(secondNext).not.to.be.called;
			});
	});

	it('should not match two requests if the URLs are the same and they have different Authorization headers', function() {
		var firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
		var firstNext = sandbox.stub().returns(Promise.resolve());
		window.d2lfetch.dedupe(firstRequest, firstNext)
			.then(function() {
				expect(firstNext).to.be.called;
			});

		var secondRequest = getRequest('/path/to/data', { Authorization: 'knock-knock' });
		var secondNext = sandbox.stub().returns(Promise.resolve());
		return window.d2lfetch.dedupe(secondRequest, secondNext)
			.then(function() {
				expect(secondNext).to.be.called;
			});
	});

	it('should not match two requests if the URLs are different and they have no Authorization header', function() {
		var firstRequest = getRequest('/path/to/data');
		var firstNext = sandbox.stub().returns(Promise.resolve());
		window.d2lfetch.dedupe(firstRequest, firstNext)
			.then(function() {
				expect(firstNext).to.be.called;
			});

		var secondRequest = getRequest('/different/path/to/data');
		var secondNext = sandbox.stub().returns(Promise.resolve());
		return window.d2lfetch.dedupe(secondRequest, secondNext)
			.then(function() {
				expect(secondNext).to.be.called;
			});
	});

	it('should not match two requests if the URLs are different and they have the same Authorization header', function() {
		var firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
		var firstNext = sandbox.stub().returns(Promise.resolve());
		window.d2lfetch.dedupe(firstRequest, firstNext)
			.then(function() {
				expect(firstNext).to.be.called;
			});

		var secondRequest = getRequest('/different/path/to/data', { Authorization: 'let-me-in' });
		var secondNext = sandbox.stub().returns(Promise.resolve());
		return window.d2lfetch.dedupe(secondRequest, secondNext)
			.then(function() {
				expect(secondNext).to.be.called;
			});
	});

	requestMethods.forEach(function(method) {
		it('should not match two requests if the URLs are the same, the authorization header is the same, but they are not GET, HEAD, or OPTIONS requests', function() {
			var firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' }, method);
			var firstNext = sandbox.stub().returns(Promise.resolve());
			window.d2lfetch.dedupe(firstRequest, firstNext)
				.then(function() {
					expect(firstNext).to.be.called;
				});

			var secondRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' }, method);
			var secondNext = sandbox.stub().returns(Promise.resolve());
			return window.d2lfetch.dedupe(secondRequest, secondNext)
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
