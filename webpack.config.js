const path = require('path');

module.exports = {
	module: {
		rules: [
			{
				test: /\.js$/,
				exclude: /(node_modules|bower_components)/,
				use: {
					loader: 'babel-loader',
					options: {
						presets: ['env']
					}
				}
			}
		]
	},
	context: path.resolve(__dirname, './src'),
	entry: {
		app: './index.js'
	},
	output: {
		path: path.resolve(__dirname, './dist'),
		filename: 'd2lfetch-dedupe.js',
		library: ['d2lfetch', 'dedupe']
	}
};
