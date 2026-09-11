import { isAppTitlebarOptions } from '../../../../src/shared/titlebar_validate';

it('accepts a complete app titlebar snapshot and reset', () => {
	expect(
		isAppTitlebarOptions({
			title: 'Workspace',
			leftButtons: [
				{
					id: 'toggle-sidebar',
					label: 'Collapse sidebar',
					icon: 'panel-left',
					expanded: true,
				},
			],
			rightButtons: [{ id: 'settings', label: 'Settings', icon: 'settings' }],
			sidebarOpen: true,
			sidebarTransitionStartedAt: 1_788_272_670_000,
			sidebarWidth: 240,
		})
	).toBe(true);
	expect(isAppTitlebarOptions(null)).toBe(true);
});

it.each([
	{ title: '' },
	{ sidebarWidth: -1 },
	{ sidebarWidth: Number.NaN },
	{ sidebarOpen: 'yes' },
	{ sidebarTransitionStartedAt: -1 },
	{ sidebarTransitionStartedAt: Number.NaN },
	{ leftButtons: [{ id: 'toggle', label: 'Toggle', icon: 'custom' }] },
	{ leftButtons: [{ id: 'toggle', label: 'Toggle', icon: 'panel-left', expanded: 'yes' }] },
	{
		leftButtons: [
			{ id: 'duplicate', label: 'First', icon: 'panel-left' },
			{ id: 'duplicate', label: 'Second', icon: 'panel-right' },
		],
	},
	{ rightButtons: new Array(7).fill({ id: 'same', label: 'Same', icon: 'settings' }) },
])('rejects malformed titlebar options: %p', (options) => {
	expect(isAppTitlebarOptions(options)).toBe(false);
});
