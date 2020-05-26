import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';

export const config = (name, input, output, cjsOutput) => ([{
	input,
	plugins: [
		resolve({
			browser: true
		}),
		commonjs(),
		json()
	],
	output: {
		file: output,
		format: 'esm',
		name,
		sourcemap: true
	}
}].concat(cjsOutput ? {
	input,
	plugins: [
		resolve({
			browser: true
		}),
		commonjs(),
		json()
	],
	output: {
		file: cjsOutput,
		format: 'cjs',
		name,
		sourcemap: true
	}
} : []));
