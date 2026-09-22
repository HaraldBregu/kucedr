import { AppRegistry } from '../../../../src/main/apps/app_registry';

describe('app registry', () => {
	function webContents(id: number) {
		const handlers = new Map<string, () => void>();
		return {
			handlers,
			value: {
				id,
				once: jest.fn((event: string, handler: () => void) => handlers.set(event, handler)),
			},
		};
	}

	it('resolves registered app views and removes crashed views', () => {
		const registry = new AppRegistry();
		const contents = webContents(7);
		registry.register(contents.value as never, 'draw');

		expect(registry.resolve(contents.value)).toBe('draw');
		contents.handlers.get('render-process-gone')?.();
		expect(() => registry.resolve(contents.value)).toThrow('registered app views');
	});

	it('rejects invalid or conflicting registrations', () => {
		const registry = new AppRegistry();
		const invalid = webContents(0);
		const contents = webContents(7);
		const conflicting = webContents(7);
		expect(() => registry.register(invalid.value as never, 'draw')).toThrow('web contents ID');
		expect(() => registry.register(contents.value as never, '../draw')).toThrow(
			'Invalid app ID'
		);

		registry.register(contents.value as never, 'draw');
		expect(() => registry.register(conflicting.value as never, 'demo')).toThrow(
			'already registered'
		);
		expect(() => registry.resolve(conflicting.value)).toThrow('registered app views');
		expect(registry.resolve(contents.value)).toBe('draw');
	});

	it('revokes every registered view for an app', () => {
		const registry = new AppRegistry();
		const first = webContents(7);
		const second = webContents(8);
		const other = webContents(9);
		registry.register(first.value as never, 'draw');
		registry.register(second.value as never, 'draw');
		registry.register(other.value as never, 'demo');

		registry.revoke('draw');

		expect(() => registry.resolve(first.value)).toThrow('registered app views');
		expect(() => registry.resolve(second.value)).toThrow('registered app views');
		expect(registry.resolve(other.value)).toBe('demo');
	});
});
