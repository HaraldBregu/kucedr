export function formatReplyMessage(message: string, replyTo?: string): string {
	const quoted = replyTo?.trim();
	if (!quoted) return message;
	return `> **Replying to Kucedr**\n>\n${quoted
		.split(/\r?\n/)
		.map((line) => `> ${line}`)
		.join('\n')}\n\n${message}`;
}
