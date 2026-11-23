import { history } from './history';

export function visit(url: string, title?: string): void {
	if (!/^https?:\/\//i.test(url)) return;
	const list = history();
	const earlier = list.find((item) => item.url === url);
	if (title !== undefined) {
		if (earlier && title && earlier.title !== title)
			history(list.map((item) => (item === earlier ? { ...item, title } : item)));
		return;
	}
	history([
		{ url, title: earlier?.title ?? '', visits: (earlier?.visits ?? 0) + 1, last: Date.now() },
		...list.filter((item) => item !== earlier),
	]);
}
