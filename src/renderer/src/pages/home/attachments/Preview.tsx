import { useEffect, useState } from 'react';
import { FileImageIcon } from 'lucide-react';

export function Preview({ file, path, name, mimeType }: { readonly file?: File; readonly path?: string; readonly name?: string; readonly mimeType?: string }): React.JSX.Element {
	const [url, setUrl] = useState<string>();

	useEffect(() => {
		if (typeof URL.createObjectURL !== 'function') return;
		let active = true;
		let previewUrl: string | undefined;
		if (file) {
			previewUrl = URL.createObjectURL(file);
			setUrl(previewUrl);
		} else if (path) {
			void window.agent.readPromptFile(path).then((bytes) => {
				if (!active) return;
				previewUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mimeType }));
				setUrl(previewUrl);
			}).catch(() => undefined);
		}
		return () => {
			active = false;
			if (previewUrl) URL.revokeObjectURL(previewUrl);
		};
	}, [file, path, mimeType]);

	return url ? <img src={url} alt={file?.name ?? name ?? ''} /> : <FileImageIcon />;
}
