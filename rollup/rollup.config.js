import { config } from './rollup.common.config.js';

export default
	config('d2lfetch.dedupe', './src/index.js', './es6/d2lfetch-dedupe.js', './dist/d2lfetch-dedupe.js');
