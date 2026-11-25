import { render } from '@testing-library/react';
import { ProviderAvatar } from '../../../src/renderer/src/components/provider-avatar';

it('enlarges a full-bleed provider icon', () => {
	const { container } = render(
		<ProviderAvatar
			providerId="brave"
			name="brave"
			iconDarkUrl="/dark.svg"
			iconLightUrl="/light.svg"
			fullBleed
		/>
	);

	expect(container.firstElementChild).toHaveClass('p-0');
	expect(container.firstElementChild).not.toHaveClass('p-1');
});
