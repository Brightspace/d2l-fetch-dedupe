'use strict';

var invalidRequestInputs = [
	undefined,
	null,
	1,
	'hello',
	{},
	{ whatiam: 'is not a Request'}
];

describe('d2l-fetch-dedupe', function() {

	var sandbox;

	function getRequest(path, headers) {
		return new Request(path, { headers: headers });
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
});
