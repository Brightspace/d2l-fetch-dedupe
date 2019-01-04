import { D2LFetchDedupe } from './d2lfetch-dedupe.js';

const fetchDedupe = new D2LFetchDedupe();

export default function dedupe(request, next) {
	return fetchDedupe.dedupe(request, next);
}
