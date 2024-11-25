import { addExtensions, browserConfig, setDirectoryConfigs, testingConfig } from 'eslint-config-brightspace';

export default addExtensions(setDirectoryConfigs(
	browserConfig,
	{
		'test': testingConfig
	}
), ['.js', '.html']);
