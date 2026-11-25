import { render } from '@testing-library/react';
import { Tool } from '../../../src/renderer/src/components/prompt-kit/tool';
import * as providers from '../../../src/renderer/src/lib/providers';

it('uses catalog service icons, provider theme icons, and the default for custom or iconless MCPs', () => {
	jest.spyOn(providers, 'mcps').mockReturnValue([
		{
			id: 'notion',
			name: 'Notion',
			type: 'mcp',
			provider: {
				id: 'notion',
				name: 'Notion',
				baseUrl: '',
				iconLightUrl: 'notion-light.svg',
				iconDarkUrl: 'notion-dark.svg',
			},
		},
		{
			id: 'google-docs',
			name: 'Docs',
			type: 'mcp',
			iconLightUrl: 'docs.svg',
			provider: {
				id: 'google',
				name: 'Google',
				baseUrl: '',
				iconDarkUrl: 'google.svg',
			},
		},
		{
			id: 'iconless',
			name: 'Iconless',
			type: 'mcp',
			provider: { id: 'iconless', name: 'Iconless', baseUrl: '' },
		},
	]);
	const { container, rerender } = render(
		<Tool toolPart={{ type: 'mcp__notion__search', state: 'input-available' }} />
	);
	expect(container.querySelector('img.dark\\:hidden')).toHaveAttribute('src', 'notion-light.svg');
	expect(container.querySelector('img.dark\\:block')).toHaveAttribute('src', 'notion-dark.svg');
	expect(container.querySelector('img')?.parentElement).toHaveClass('size-3.5');

	rerender(
		<Tool
			toolPart={{
				type: 'read_document',
				serviceKind: 'mcp',
				serviceId: 'google-docs',
				state: 'output-available',
			}}
		/>
	);
	expect([...container.querySelectorAll('img')].map((image) => image.src)).toEqual([
		'http://localhost/docs.svg',
		'http://localhost/docs.svg',
	]);
	for (const serviceId of ['iconless', 'custom-server']) {
		rerender(
			<Tool
				toolPart={{
					type: `mcp__${serviceId}__search`,
					serviceKind: 'mcp',
					serviceId,
					state: 'output-error',
				}}
			/>
		);
		expect(container.querySelector('img')).not.toBeInTheDocument();
		expect(container.querySelector('svg.lucide-plug')).toBeInTheDocument();
	}
});
