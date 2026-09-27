import { getAssetUrlsByImport } from '@tldraw/assets/imports.vite';
import { useEffect, useRef, useState } from 'react';
import { Tldraw, parseTldrawJsonFile, serializeTldrawJson } from 'tldraw';

interface TldrawEditorProps {
	content: string;
	isDark: boolean;
	onChange: (content: string) => void;
}

const assetUrls = getAssetUrlsByImport();
const licenseKey = import.meta.env.VITE_TLDRAW_LICENSE_KEY || undefined;

export default function TldrawEditor({ content, isDark, onChange }: TldrawEditorProps) {
	const [error, setError] = useState('');
	const activeRef = useRef(true);
	const generationRef = useRef(0);
	const onChangeRef = useRef(onChange);
	const timerRef = useRef<number | undefined>(undefined);
	const unsubscribeRef = useRef<(() => void) | undefined>(undefined);

	useEffect(() => {
		onChangeRef.current = onChange;
	}, [onChange]);

	useEffect(() => {
		activeRef.current = true;
		return () => {
			activeRef.current = false;
			generationRef.current += 1;
			window.clearTimeout(timerRef.current);
			unsubscribeRef.current?.();
		};
	}, []);

	return (
		<div className="relative h-full min-h-0 overflow-hidden bg-background">
			<Tldraw
				assetUrls={assetUrls}
				autoFocus
				colorScheme={isDark ? 'dark' : 'light'}
				licenseKey={licenseKey}
				onMount={(editor) => {
					if (content.trim()) {
						const parsed = parseTldrawJsonFile({ json: content, schema: editor.store.schema });
						if (!parsed.ok) {
							setError('This tldraw file is invalid or was created by an unsupported version.');
							return;
						}
						editor.loadSnapshot(parsed.value.getStoreSnapshot());
						editor.clearHistory();
						const bounds = editor.getCurrentPageBounds();
						if (bounds) editor.zoomToBounds(bounds, { immediate: true, targetZoom: 1 });
					}
					const persist = () => {
						window.clearTimeout(timerRef.current);
						timerRef.current = window.setTimeout(() => {
							const generation = ++generationRef.current;
							void serializeTldrawJson(editor).then((serialized) => {
								if (activeRef.current && generation === generationRef.current) {
									onChangeRef.current(serialized);
								}
							});
						}, 200);
					};
					unsubscribeRef.current = editor.store.listen(persist, {
						source: 'user',
						scope: 'document',
					});
					if (!content.trim()) persist();
				}}
			/>
			{error ? (
				<div className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 px-6 text-center text-sm text-destructive">
					{error}
				</div>
			) : null}
		</div>
	);
}
