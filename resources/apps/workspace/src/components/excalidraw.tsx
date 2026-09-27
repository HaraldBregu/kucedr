import {
	DefaultSidebar,
	Excalidraw,
	MainMenu,
	THEME,
	loadFromBlob,
	serializeAsJSON,
} from '@excalidraw/excalidraw';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ExcalidrawEditorProps {
	content: string;
	isDark: boolean;
	onChange: (content: string) => void;
	path: string;
}

export default function ExcalidrawEditor({
	content,
	isDark,
	onChange,
	path,
}: ExcalidrawEditorProps) {
	const [initialContent] = useState(content);
	const [initialData, setInitialData] = useState<
		Awaited<ReturnType<typeof loadFromBlob>> | null | undefined
	>();
	const [error, setError] = useState('');

	useEffect(() => {
		let active = true;
		if (!initialContent.trim()) {
			setInitialData(null);
			return () => {
				active = false;
			};
		}
		void loadFromBlob(
			new Blob([initialContent], { type: 'application/vnd.excalidraw+json' }),
			null,
			null
		)
			.then((data) => {
				if (active) setInitialData(data);
			})
			.catch((reason) => {
				if (active) {
					setError(
						reason instanceof Error ? reason.message : 'Unable to open this Excalidraw file.'
					);
				}
			});
		return () => {
			active = false;
		};
	}, [initialContent]);

	if (error) {
		return (
			<div className="flex h-full items-center justify-center px-6 text-center text-sm text-destructive">
				{error}
			</div>
		);
	}
	if (initialData === undefined) {
		return (
			<div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
				<LoaderCircle className="h-4 w-4 animate-spin" /> Loading Excalidraw file...
			</div>
		);
	}

	return (
		<div className="h-full min-h-0 overflow-hidden bg-background">
			<Excalidraw
				autoFocus
				handleKeyboardGlobally
				initialData={initialData}
				name={path.split(/[\\/]/).pop() ?? path}
				theme={isDark ? THEME.DARK : THEME.LIGHT}
				onChange={(elements, appState, files) => {
					onChange(serializeAsJSON(elements, appState, files, 'local'));
				}}
				UIOptions={{
					canvasActions: {
						loadScene: false,
						saveToActiveFile: false,
						toggleTheme: false,
					},
				}}
			>
				<MainMenu>
					<MainMenu.DefaultItems.CommandPalette />
					<MainMenu.DefaultItems.SearchMenu />
					<MainMenu.DefaultItems.Export />
					<MainMenu.DefaultItems.Help />
					<MainMenu.Separator />
					<MainMenu.DefaultItems.ClearCanvas />
					<MainMenu.DefaultItems.ChangeCanvasBackground />
				</MainMenu>
				<DefaultSidebar />
			</Excalidraw>
		</div>
	);
}
