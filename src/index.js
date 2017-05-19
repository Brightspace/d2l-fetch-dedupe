import { D2LFetchDedupe } from './d2lfetch-dedupe.js';

const fetchDedupe = new D2LFetchDedupe();

module.exports = function dedupe(request, next) {
	return fetchDedupe.dedupe(request, next);
};
