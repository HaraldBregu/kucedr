// ponytail: compares major.minor.patch only; pre-release tags are ignored
export function compareVersions(left: string, right: string): number {
	const parse = (version: string): number[] => version.split(/[-+]/)[0].split('.').map(Number);
	const [a, b] = [parse(left), parse(right)];
	for (let index = 0; index < 3; index++) {
		if (a[index] !== b[index]) return a[index] - b[index];
	}
	return 0;
}
