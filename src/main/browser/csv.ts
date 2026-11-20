// Minimal RFC-4180 reader: quoted fields, escaped quotes, newlines inside quotes.
function parse(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	for (let i = 0; i < text.length; i += 1) {
		const char = text[i];
		if (quoted) {
			if (char === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i += 1;
				} else quoted = false;
			} else field += char;
			continue;
		}
		if (char === '"') quoted = true;
		else if (char === ',') {
			row.push(field);
			field = '';
		} else if (char === '\n' || char === '\r') {
			if (char === '\r' && text[i + 1] === '\n') i += 1;
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else field += char;
	}
	if (field !== '' || row.length) {
		row.push(field);
		rows.push(row);
	}
	return rows.filter((entry) => entry.some((value) => value.trim() !== ''));
}

// Any browser or password manager exports a CSV; column names differ, so fields are found
// by what their header means, never by a product's layout.
function column(headers: string[], exact: string[], loose: string[], avoid: string[] = []): number {
	for (const name of exact) {
		const index = headers.indexOf(name);
		if (index >= 0) return index;
	}
	for (const name of loose) {
		const index = headers.findIndex(
			(header) => header.includes(name) && !avoid.some((bad) => header.includes(bad))
		);
		if (index >= 0) return index;
	}
	return -1;
}

export interface CsvLogin {
	url: string;
	username: string;
	password: string;
}

export function readLogins(text: string): CsvLogin[] {
	const rows = parse(text);
	if (rows.length < 2) return [];
	const headers = rows[0].map((header) => header.trim().toLowerCase());
	const urlAt = column(headers, ['url', 'login_uri', 'origin', 'website', 'hostname'], ['url', 'origin', 'site'], ['action']);
	const userAt = column(headers, ['username', 'login', 'user', 'email', 'login_username'], ['user', 'email'], []);
	const passAt = column(headers, ['password', 'login_password'], ['password'], []);
	if (urlAt < 0 || passAt < 0) return [];
	return rows
		.slice(1)
		.map((row) => ({
			url: (row[urlAt] ?? '').trim(),
			username: userAt >= 0 ? (row[userAt] ?? '').trim() : '',
			password: row[passAt] ?? '',
		}))
		.filter((login) => login.password !== '' && /^https?:\/\//i.test(login.url));
}

export function demo(): void {
	const chrome = readLogins('name,url,username,password,note\nExample,https://a.example/,sam,"p,1",hi');
	console.assert(chrome.length === 1 && chrome[0].password === 'p,1' && chrome[0].username === 'sam', 'chrome csv');
	const firefox = readLogins(
		'"url","username","password","httpRealm","formActionOrigin"\n"https://b.example/","jo","sec""et","","https://login.b.example/"'
	);
	console.assert(firefox.length === 1 && firefox[0].url === 'https://b.example/' && firefox[0].password === 'sec"et', 'firefox csv + action column avoided');
	console.assert(readLogins('url,password\nftp://x/,p').length === 0, 'non-web rows dropped');
}

if (process.argv[1]?.endsWith('csv.ts')) demo();
