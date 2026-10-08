import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Restore from '../../../src/renderer/src/pages/settings/pages/storage/Restore';
import mockTranslations from '../../../resources/i18n/en/main.json';

jest.mock('react-i18next', () => {
	const t = (key: string): string => {
		let value: unknown = mockTranslations;
		for (const part of key.split('.'))
			value =
				value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined;
		return String(value ?? key);
	};
	return { useTranslation: () => ({ t }) };
});


it('confirms an ordinary download without version or backup selectors', async () => {
	const onRestore = jest.fn();
	const user = userEvent.setup();
	render(<Restore open disabled={false} hasFolders onOpenChange={jest.fn()} onRestore={onRestore} />);
	expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
	await user.click(screen.getByRole('button', { name: 'Download files' }));
	expect(onRestore).toHaveBeenCalledWith();
});

it('requires selected folders before downloading', () => {
	render(<Restore open disabled={false} hasFolders={false} onOpenChange={jest.fn()} onRestore={jest.fn()} />);
	expect(screen.getByRole('button', { name: 'Download files' })).toBeDisabled();
});

it('cancels without starting a download', async () => {
	const onRestore = jest.fn();
	const onOpenChange = jest.fn();
	const user = userEvent.setup();
	render(<Restore open disabled={false} hasFolders onOpenChange={onOpenChange} onRestore={onRestore} />);
	await user.click(screen.getByRole('button', { name: 'Cancel' }));
	expect(onOpenChange).toHaveBeenCalledWith(false);
	expect(onRestore).not.toHaveBeenCalled();
});
