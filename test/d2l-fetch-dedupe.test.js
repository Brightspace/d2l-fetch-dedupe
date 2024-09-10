import { fetchDedupe, reset } from '../src/index.js';
import { expect } from '@brightspace-ui/testing';
import sinon from 'sinon';

const invalidRequestInputs = [
	undefined,
	null,
	1,
	'hello',
	{},
	{ whatiam: 'is not a Request' }
];

const requestMethods = [
	'DELETE',
	'GET',
	'HEAD',
	'OPTIONS',
	'PATCH',
	'POST',
	'PUT'
];

function createSuccessResponse() {
	return Promise.resolve(new Response('request successful', {
		status: 200
	}));
}

describe('d2l-fetch-dedupe', () => {

	function getRequest(path, headers, method, abortController) {
		method = method || 'GET';
		return new Request(path, {
			method: method,
			headers: headers,
			signal: abortController && abortController.signal
		});
	}

	afterEach(() => {
		sinon.restore();
		reset();
	});

	invalidRequestInputs.forEach((input) => {
		it('should throw a TypeError if it is not passed a Request object', () => {
			return fetchDedupe(input)
				.then((() => { expect.fail(); }), (err) => expect(err).to.be.an.instanceof(TypeError));
		});
	});

	it('should call the next function if provided', async() => {
		const next = sinon.stub().returns(createSuccessResponse());
		await fetchDedupe(getRequest('/path/to/data'), next);
		expect(next).to.be.called;
	});

	it('should pass a request with the correct properties to the next function', async() => {
		const req = new Request('http://localhost:8000/path/to/data', {
			method: 'GET',
			headers: new Headers({
				'Authorization': 'Bearer foo',
				'X-Other-Header': 'some value'
			}),
			mode: 'same-origin',
			cache: 'no-store',
			credentials: 'include'
		});

		const next = sinon.stub().returns(createSuccessResponse());

		await fetchDedupe(req, next);
		expect(next).to.be.called;

		const nextReqArg = next.getCall(0).args[0];
		expect(nextReqArg.url).to.equal('http://localhost:8000/path/to/data');
		expect(nextReqArg.method).to.equal('GET');
		expect(nextReqArg.headers.get('Authorization')).to.equal('Bearer foo');
		expect(nextReqArg.headers.get('X-Other-Header')).to.equal('some value');
		expect(nextReqArg.mode).to.equal('same-origin');
		expect(nextReqArg.cache).to.equal('no-store');
		expect(nextReqArg.credentials).to.equal('include');
	});

	it('should not call the next function if a matching request exists in flight', async() => {
		const firstRequest = getRequest('/path/to/data');
		const firstNext = sinon.stub().returns(createSuccessResponse());
		const secondRequest = getRequest('/path/to/data');
		const secondNext = sinon.stub().returns(createSuccessResponse());

		await Promise.all([fetchDedupe(firstRequest, firstNext), fetchDedupe(secondRequest, secondNext)]);
		expect(firstNext).to.be.called;
		expect(secondNext).not.to.be.called;
	});

	it('should call the next function if a matching request has completed', async() => {
		const firstRequest = getRequest('/path/to/data');
		const firstNext = sinon.stub().returns(createSuccessResponse());

		await fetchDedupe(firstRequest, firstNext);
		expect(firstNext).to.be.called;

		const secondRequest = getRequest('/path/to/data');
		const secondNext = sinon.stub().returns(createSuccessResponse());
		await fetchDedupe(secondRequest, secondNext);
		expect(secondNext).to.be.called;
	});

	it('matched responses should be have their bodies cloned so that the body can be requested by each caller', async() => {
		const matchedResponse = new Response('{ dataprop: \'sweet sweet data\' }', { status: 200, statusText: 'super!' });
		const firstRequest = getRequest('/path/to/data');
		const firstNext = sinon.stub().returns(Promise.resolve(matchedResponse));
		const secondRequest = getRequest('/path/to/data');
		const secondNext = sinon.stub().returns(Promise.reject);
		const thirdRequest = getRequest('/path/to/data');
		const thirdNext = sinon.stub().returns(Promise.reject);

		const responses = await Promise.all([
			fetchDedupe(firstRequest, firstNext),
			fetchDedupe(secondRequest, secondNext),
			fetchDedupe(thirdRequest, thirdNext)
		]);

		// expect the same promises
		expect(responses[0]).to.equal(responses[1]);
		expect(responses[1]).to.equal(responses[2]);
		// body should be used at this point, technically
		expect(responses[0].bodyUsed).to.equal(true);

		const bodies = await Promise.all([
			responses[0].json,
			responses[1].json,
			responses[2].json
		]);
		// expect the same bodies
		expect(bodies[0]).to.equal(bodies[1]);
		expect(bodies[1]).to.equal(bodies[2]);
		expect(bodies[0]).to.equal(bodies[2]);
	});

	it('unmatched responses should not have their bodies cloned and the body should be read at the time the caller requests it', async() => {
		const response = new Response('{ dataprop: \'sweet sweet data\' }', { status: 200, statusText: 'super!' });
		const firstRequest = getRequest('/path/to/data');
		const firstNext = sinon.stub().returns(Promise.resolve(response));
		await fetchDedupe(firstRequest, firstNext);
		expect(firstNext).to.be.called;
		expect(response.bodyUsed).to.equal(false);

		await response.text();
		expect(response.bodyUsed).to.equal(true);
	});

	it('should allow calls to blob() for unmatched responses', async() => {
		const data = JSON.stringify({ dataprop: 'sweet sweet data' });
		const response1 = new Response(data, { status: 200, statusText: 'super!' });
		const firstRequest = getRequest('/path/to/data');
		const firstNext = sinon.stub().returns(Promise.resolve(response1));
		const response2 = await fetchDedupe(firstRequest, firstNext);
		const blobData = await response2.blob();
		expect(blobData).to.not.be.undefined;
		expect(blobData.size).to.equal(data.length);
	});

	it('should reject calls to blob() for matched responses', async() => {
		const matchedResponse = new Response('{ dataprop: \'sweet sweet data\' }', { status: 200, statusText: 'super!' });
		const firstRequest = getRequest('/path/to/data');
		const firstNext = sinon.stub().returns(Promise.resolve(matchedResponse));
		const secondRequest = getRequest('/path/to/data');
		const secondNext = sinon.stub().returns(Promise.reject);

		const responses = await Promise.all([
			fetchDedupe(firstRequest, firstNext),
			fetchDedupe(secondRequest, secondNext)
		]);
		return responses[0].blob()
			.then(() => expect.fail())
			.catch((err) => expect(err.message).to.equal('dedupe middleware cannot be used with blob response bodies'));
	});

	it('should allow calls to formData() for unmatched responses', async() => {
		const data = new FormData();
		data.append('dataprop', 'sweet sweet data');
		const response1 = new Response(data, { status: 200, statusText: 'super!' });
		const firstRequest = getRequest('/path/to/data');
		const firstNext = sinon.stub().returns(Promise.resolve(response1));
		const response2 = await fetchDedupe(firstRequest, firstNext);
		const formData = await response2.formData();
		expect(formData instanceof FormData).to.be.true;
		expect(formData.get('dataprop')).to.equal('sweet sweet data');
	});

	it('should reject calls to formData() for matched responses', async() => {
		const matchedResponse = new Response('{ dataprop: \'sweet sweet data\' }', { status: 200, statusText: 'super!' });
		const firstRequest = getRequest('/path/to/data');
		const firstNext = sinon.stub().returns(Promise.resolve(matchedResponse));
		const secondRequest = getRequest('/path/to/data');
		const secondNext = sinon.stub().returns(Promise.reject);

		const responses = await Promise.all([
			fetchDedupe(firstRequest, firstNext),
			fetchDedupe(secondRequest, secondNext)
		]);
		return responses[0].formData()
			.then(() => expect.fail())
			.catch((err) => expect(err.message).to.equal('dedupe middleware cannot be used with formData response bodies'));
	});

	it('should allow calls to arrayBuffer() for unmatched responses', async() => {
		const data = window.btoa('sweet sweet data');
		const response1 = new Response(data, { status: 200, statusText: 'super!' });
		const firstRequest = getRequest('/path/to/data');
		const firstNext = sinon.stub().returns(Promise.resolve(response1));
		const response2 = await fetchDedupe(firstRequest, firstNext);
		const arrayBufferData = await response2.arrayBuffer();
		expect(arrayBufferData instanceof ArrayBuffer).to.be.true;
		expect(window.atob(String.fromCharCode(...new Uint8Array(arrayBufferData)))).to.equal('sweet sweet data');
	});

	it('should reject calls to arrayBuffer() for matched responses', async() => {
		const matchedResponse = new Response('{ dataprop: \'sweet sweet data\' }', { status: 200, statusText: 'super!' });
		const firstRequest = getRequest('/path/to/data');
		const firstNext = sinon.stub().returns(Promise.resolve(matchedResponse));
		const secondRequest = getRequest('/path/to/data');
		const secondNext = sinon.stub().returns(Promise.reject);

		const responses = await Promise.all([
			fetchDedupe(firstRequest, firstNext),
			fetchDedupe(secondRequest, secondNext)
		]);
		return responses[0].arrayBuffer()
			.then(() => expect.fail())
			.catch((err) => expect(err.message).to.equal('dedupe middleware cannot be used with arrayBuffer response bodies'));
	});

	it('should match two requests if the URLs are the same and they have no Authorization header', async() => {
		const firstRequest = getRequest('/path/to/data');
		const firstNext = sinon.stub().returns(createSuccessResponse());
		const secondRequest = getRequest('/path/to/data');
		const secondNext = sinon.stub().returns(createSuccessResponse());

		await Promise.all([
			fetchDedupe(firstRequest, firstNext),
			fetchDedupe(secondRequest, secondNext)
		]);

		expect(firstNext).to.be.called;
		expect(secondNext).not.to.be.called;
	});

	it('should match two requests if the URLs are the same and they have the same Authorization header', async() => {
		const firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
		const firstNext = sinon.stub().returns(createSuccessResponse());
		const secondRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
		const secondNext = sinon.stub().returns(createSuccessResponse());

		await Promise.all([
			fetchDedupe(firstRequest, firstNext),
			fetchDedupe(secondRequest, secondNext)
		]);

		expect(firstNext).to.be.called;
		expect(secondNext).not.to.be.called;
	});

	it('should not match two requests if the URLs are the same and they have different Authorization headers', async() => {
		const firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
		const firstNext = sinon.stub().returns(createSuccessResponse());
		const secondRequest = getRequest('/path/to/data', { Authorization: 'knock-knock' });
		const secondNext = sinon.stub().returns(createSuccessResponse());

		await Promise.all([
			fetchDedupe(firstRequest, firstNext),
			fetchDedupe(secondRequest, secondNext)
		]);

		expect(firstNext).to.be.called;
		expect(secondNext).to.be.called;
	});

	it('should not match two requests if the URLs are different and they have no Authorization header', async() => {
		const firstRequest = getRequest('/path/to/data');
		const firstNext = sinon.stub().returns(createSuccessResponse());
		const secondRequest = getRequest('/different/path/to/data');
		const secondNext = sinon.stub().returns(createSuccessResponse());

		await Promise.all([
			fetchDedupe(firstRequest, firstNext),
			fetchDedupe(secondRequest, secondNext)
		]);

		expect(firstNext).to.be.called;
		expect(secondNext).to.be.called;
	});

	it('should not match two requests if the URLs are different and they have the same Authorization header', async() => {
		const firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
		const firstNext = sinon.stub().returns(createSuccessResponse());
		const secondRequest = getRequest('/different/path/to/data', { Authorization: 'let-me-in' });
		const secondNext = sinon.stub().returns(createSuccessResponse());

		await Promise.all([
			fetchDedupe(firstRequest, firstNext),
			fetchDedupe(secondRequest, secondNext)
		]);

		expect(firstNext).to.be.called;
		expect(secondNext).to.be.called;
	});

	it('should abort downstream request if only remaining upstream request was aborted', (done) => {
		const abortController = new AbortController();
		const currState = {
			downstreamReqAborted: false,
			upstreamReqAborted: false
		};
		const successState = {
			downstreamReqAborted: true,
			upstreamReqAborted: true
		};
		let fetchResolvers;

		const firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' }, 'GET', abortController);
		const firstNext = req => {
			const fetchPromise = new Promise((resolve, reject) => {
				fetchResolvers = { resolve, reject };
			});

			req.signal.addEventListener('abort', () => {
				fetchResolvers.reject(new DOMException('Request aborted', 'AbortError'));

				currState.downstreamReqAborted = true;
			});

			return fetchPromise;
		};

		fetchDedupe(firstRequest, firstNext)
			.catch((err) => {
				expect(err.message).to.equal('Request was aborted.');

				currState.upstreamReqAborted = true;
			});

		abortController.abort();

		setTimeout(() => {
			expect(currState).to.deep.equal(successState);
			done();
		});
	});

	it('should not abort downstream request if at least one upstream request was not aborted', async() => {
		const abortController = new AbortController();
		const successState = {
			downstreamReqAborted: false,
			firstUpstreamReqAborted: true,
			secondUpstreamReqAborted: true,
			thirdUpstreamReqAborted: false
		};
		const currState = {
			downstreamReqAborted: false,
			firstUpstreamReqAborted: false,
			secondUpstreamReqAborted: false,
			thirdUpstreamReqAborted: false
		};

		const firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' }, 'GET', abortController);
		const secondRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' }, 'GET', abortController);
		const thirdRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' }, 'GET');

		let fetchResolvers;

		const firstNext = req => {
			const fetchPromise = new Promise((resolve, reject) => {
				fetchResolvers = { resolve, reject };
			});

			req.signal.addEventListener('abort', () => {
				fetchResolvers.reject(new DOMException('Request aborted', 'AbortError'));

				currState.downstreamReqAborted = true;
			});

			return fetchPromise;
		};

		const secondNext = sinon.stub().returns(Promise.reject());
		const thirdNext = sinon.stub().returns(Promise.reject());

		fetchDedupe(firstRequest, firstNext)
			.catch((err) => {
				expect(err.message).to.equal('Request was aborted.');
				currState.firstUpstreamReqAborted = true;
			});
		fetchDedupe(secondRequest, secondNext)
			.catch((err) => {
				expect(secondNext).not.to.be.called;
				expect(err.message).to.equal('Request was aborted.');
				currState.secondUpstreamReqAborted = true;
			});
		fetchDedupe(thirdRequest, thirdNext)
			.catch(() => {
				expect(thirdNext).not.to.be.called;
				currState.thirdUpstreamReqAborted = true;
			});

		abortController.abort();

		return new Promise((resolve) => {
			setTimeout(() => {
				fetchResolvers.resolve();
				expect(currState).to.deep.equal(successState);
				resolve();
			});
		});
	});

	it('should release request promises that were rejected', (done) => {
		const firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
		const firstNext = sinon.stub().returns(Promise.reject(new Error()));
		const secondRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
		const secondNext = sinon.stub().returns(createSuccessResponse());

		fetchDedupe(firstRequest, firstNext)
			.catch(() => {
				return fetchDedupe(secondRequest, secondNext);
			})
			.then(() => {
				expect(secondNext).to.be.called;
				done();
			});
	});

	requestMethods.forEach((method) => {
		it('should not match two requests if the URLs are the same, the authorization header is the same, but they are not GET, HEAD, or OPTIONS requests', async() => {
			const firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' }, method);
			const firstNext = sinon.stub().returns(createSuccessResponse());
			const secondRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' }, method);
			const secondNext = sinon.stub().returns(createSuccessResponse());

			await Promise.all([
				fetchDedupe(firstRequest, firstNext),
				fetchDedupe(secondRequest, secondNext)
			]);

			expect(firstNext).to.be.called;
			if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
				expect(secondNext).not.to.be.called;
			} else {
				expect(secondNext).to.be.called;
			}
		});
	});
});
