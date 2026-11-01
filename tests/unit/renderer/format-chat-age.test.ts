import { formatChatAge } from '../../../src/renderer/src/pages/home/formatChatAge';

it('formats chat ages in compact units and older dates as years', () => {
	const now = new Date(2026, 10, 1).getTime();
	const day = 24 * 60 * 60 * 1000;
	expect(formatChatAge(now - 2 * 60_000, now)).toBe('2m');
	expect(formatChatAge(now - 2 * 60 * 60_000, now)).toBe('2h');
	expect(formatChatAge(now - 3 * day, now)).toBe('3d');
	expect(formatChatAge(now - 28 * day, now)).toBe('4w');
	expect(formatChatAge(now - 90 * day, now)).toBe('3M');
	expect(formatChatAge(new Date(2023, 0, 1).getTime(), now)).toBe('2023');
});
