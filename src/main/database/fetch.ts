export function vectorFetch(signal?: AbortSignal): typeof fetch {
	return async (input, init) => {
		const requestSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
		const combined =
			signal && requestSignal
				? AbortSignal.any([signal, requestSignal])
				: (signal ?? requestSignal ?? undefined);
		combined?.throwIfAborted();
		return fetch(input, { ...init, signal: combined });
	};
}
