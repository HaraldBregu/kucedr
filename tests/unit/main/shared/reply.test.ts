import { formatReplyMessage } from '../../../../src/shared/reply';

it('keeps ordinary prompts unchanged when no reply is selected', () => {
	expect(formatReplyMessage('  My draft\n')).toBe('  My draft\n');
	expect(formatReplyMessage('  My draft\n', ' \n ')).toBe('  My draft\n');
});

it('quotes every assistant line separately while preserving the user message', () => {
	expect(formatReplyMessage('  Explain the second option.\n', ' First\r\n\r\nSecond ')).toBe(
		'> **Replying to Kucedr**\n>\n> First\n> \n> Second\n\n  Explain the second option.\n'
	);
});
