import path from 'node:path';
import { resolveTemplatePath } from '../../../../../src/main/agent/system/system_resolve_template_path';

describe('resolveTemplatePath', () => {
	const resourcesPath = Object.getOwnPropertyDescriptor(process, 'resourcesPath');
	const defaultApp = Object.getOwnPropertyDescriptor(process, 'defaultApp');

	afterEach(() => {
		if (resourcesPath) Object.defineProperty(process, 'resourcesPath', resourcesPath);
		else delete process.resourcesPath;
		if (defaultApp) Object.defineProperty(process, 'defaultApp', defaultApp);
		else delete process.defaultApp;
	});

	it('uses packaged resources instead of the process working directory', () => {
		Object.defineProperty(process, 'resourcesPath', {
			value: '/packaged',
			configurable: true,
		});
		Object.defineProperty(process, 'defaultApp', { value: false, configurable: true });

		expect(resolveTemplatePath('BOOTSTRAP.md')).toBe(
			path.join('/packaged', 'resources', 'templates', 'BOOTSTRAP.md')
		);
	});

	it('uses the project resources when running the default development app', () => {
		Object.defineProperty(process, 'resourcesPath', {
			value: '/electron',
			configurable: true,
		});
		Object.defineProperty(process, 'defaultApp', { value: true, configurable: true });

		expect(resolveTemplatePath('BOOTSTRAP.md')).toBe(
			path.resolve(process.cwd(), 'resources', 'templates', 'BOOTSTRAP.md')
		);
	});
});
