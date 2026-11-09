function describeOne(error) {
	if (!(error instanceof Error)) return String(error);
	const parts = [];
	const label = error.code || (error.name !== 'Error' ? error.name : undefined);
	parts.push(label ? `${label}: ${error.message}` : error.message);
	const metadata = error.$metadata;
	if (metadata?.httpStatusCode) parts.push(`HTTP ${metadata.httpStatusCode}`);
	if (metadata?.requestId) parts.push(`requestId: ${metadata.requestId}`);
	if (metadata?.extendedRequestId) parts.push(`extendedRequestId: ${metadata.extendedRequestId}`);
	if (metadata?.cfId) parts.push(`cfId: ${metadata.cfId}`);
	return parts.join(', ');
}

export function describe(error) {
	const chain = [describeOne(error)];
	let cause = error instanceof Error ? error.cause : undefined;
	while (cause) {
		chain.push(describeOne(cause));
		cause = cause instanceof Error ? cause.cause : undefined;
	}
	return chain.join(' — caused by: ');
}
