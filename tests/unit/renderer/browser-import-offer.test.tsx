import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserImportOffer } from '../../../src/renderer/src/pages/home/browser/ImportOffer';

jest.mock('@/components/ui/dialog', () => ({
	Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
	DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

it('lists detected profiles and opens the browser import settings', async () => {
	const user = userEvent.setup();
	const onDismiss = jest.fn();
	render(
		<BrowserImportOffer
			sources={[
				{
					id: 'chrome-default',
					app: 'Chrome',
					profile: 'Default',
					folder: 'Default',
					kinds: ['bookmarks', 'history'],
					used: 1,
				},
			]}
			onDismiss={onDismiss}
		/>
	);

	expect(screen.getByRole('heading', { name: 'settings.browser.importOfferTitle' })).toBeInTheDocument();
	expect(screen.getByText('Chrome — Default')).toBeInTheDocument();
	await user.click(screen.getByRole('button', { name: 'settings.browser.importOfferAction' }));
	expect(onDismiss).toHaveBeenCalledTimes(1);
	expect(window.location.hash).toBe('#/settings/browser');
});
