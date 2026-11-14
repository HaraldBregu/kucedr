import { responseBytes } from './bytes';

export async function responseText(response: Response, limit: number): Promise<string> {
	const { bytes, truncated } = await responseBytes(response, limit);
	if (truncated) throw new Error('Page is too large.');
	return new TextDecoder().decode(bytes);
}
