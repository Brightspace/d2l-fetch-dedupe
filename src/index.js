import { D2LFetchDedupe } from './d2lfetch-dedupe.js';

const dedupe = new D2LFetchDedupe();

export function fetchDedupe(request, next) {
	return dedupe.dedupe(request, next);
}

export function reset() {
	dedupe._reset();
}
