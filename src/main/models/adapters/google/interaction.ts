export type GoogleContent = { type?: string; data?: string; mime_type?: string; text?: string; uri?: string };
type GoogleInteraction = { status?: string; error?: { message?: string }; steps?: Array<{ type?: string; content?: GoogleContent[] }> };

export async function requestGoogleInteraction(
	provider: { name: string; apiKey: string; baseURL?: string },
	body: Record<string, unknown>,
	errors: { auth: new (message: string) => Error; request: new (message: string) => Error },
	signal?: AbortSignal,
): Promise<GoogleContent[]> {
	const baseURL = (provider.baseURL ?? 'https://generativelanguage.googleapis.com/v1beta').replace(/\/openai\/?$/, '');
	const response = await fetch(`${baseURL}/interactions`, {
		method: 'POST', signal,
		headers: { 'x-goog-api-key': provider.apiKey, 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	if (response.status === 401 || response.status === 403) throw new errors.auth(`${provider.name}: authentication failed.`);
	if (!response.ok) throw new errors.request(`${provider.name} request failed (${response.status}): ${await response.text()}`);
	const interaction = await response.json() as GoogleInteraction;
	if (interaction.error || ['failed', 'cancelled', 'incomplete'].includes(interaction.status ?? '')) throw new errors.request(`${provider.name}: generation failed. ${interaction.error?.message ?? interaction.status ?? ''}`.trim());
	return interaction.steps?.filter((step) => step.type === 'model_output').flatMap((step) => step.content ?? []) ?? [];
}
