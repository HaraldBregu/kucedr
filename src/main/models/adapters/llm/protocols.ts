export const PROTOCOLS: Readonly<Record<string, { readonly documents: boolean }>> = {
	messages: { documents: true },
	responses: { documents: true },
	'chat-completions': { documents: false },
};
