export function accepts(name: string, accept: string | undefined): boolean {
	if (accept === undefined) return true;
	const dot = name.lastIndexOf('.');
	return dot > 0 && accept.split(',').includes(name.slice(dot).toLowerCase());
}
