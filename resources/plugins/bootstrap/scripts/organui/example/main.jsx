// Runs the OrganUI script on each example input and shows what it prints.
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CATALOG } from '../src/catalog.mjs';
import examples from './examples.json';

async function runScript(payload) {
	const res = await fetch('/run', { method: 'POST', body: JSON.stringify(payload) });
	return { ok: res.ok, text: await res.text() };
}

function Output({ payload }) {
	const [result, setResult] = useState(null);
	useEffect(() => {
		let live = true;
		setResult(null);
		runScript(payload).then((r) => live && setResult(r));
		return () => {
			live = false;
		};
	}, [JSON.stringify(payload)]);
	if (!result) return <div className="output">Running…</div>;
	if (!result.ok) return <pre className="output error">{result.text}</pre>;
	return <iframe className="output" title="Script output" loading="lazy" srcDoc={result.text} />;
}

function Playground() {
	const { theme, input } = examples.find((example) => example.name === 'body-map');
	const [text, setText] = useState(JSON.stringify({ theme, input }, null, 2));
	const [payload, setPayload] = useState(() => JSON.parse(text));
	const [parseError, setParseError] = useState(null);
	const submit = (e) => {
		e.preventDefault();
		try {
			setPayload(JSON.parse(text));
			setParseError(null);
		} catch (error) {
			setParseError(error.message);
		}
	};
	return (
		<form className="card" onSubmit={submit}>
			<h2>Try your own input</h2>
			<textarea rows={12} spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} />
			<button type="submit">Run script</button>
			{parseError ? <pre className="output error">{parseError}</pre> : <Output payload={payload} />}
		</form>
	);
}

function App() {
	return (
		<main>
			<h1>OrganUI script examples</h1>
			<p>
				Each card pipes <code>{'{ input, theme }'}</code> into <code>dist/index.mjs</code> and renders the HTML it
				prints.
			</p>
			<Playground />
			{Object.entries(Object.groupBy(examples, (example) => CATALOG[example.input.component].group)).map(
				([group, items]) => (
					<section key={group}>
						<h2 className="group">
							{group} ({items.length})
						</h2>
						<div className="grid">
							{items.map(({ name, theme, input }) => (
								<article className="card" key={name}>
									<h2>{name}</h2>
									<Output payload={{ theme, input }} />
									<details>
										<summary>Input</summary>
										<pre>{JSON.stringify({ theme, input }, null, 2)}</pre>
									</details>
								</article>
							))}
						</div>
					</section>
				)
			)}
		</main>
	);
}

createRoot(document.getElementById('root')).render(
	<StrictMode>
		<App />
	</StrictMode>
);
