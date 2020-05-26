import { D2LFetchDedupe } from './d2lfetch-dedupe.js';

const fetchDedupe = new D2LFetchDedupe();

/**
 * d2l-fetch middleware which deduplicates fetch requests.
 *
 * @param {Request} request
 * @param {(request: Request) => Promise<Response>} next
 */
export default function dedupe(request, next) {
	return fetchDedupe.dedupe(request, next);
}
