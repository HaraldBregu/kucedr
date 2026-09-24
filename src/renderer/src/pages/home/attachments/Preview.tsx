import { useEffect, useState } from 'react';
import { FileImageIcon } from 'lucide-react';

export function Preview({ file }: { readonly file: File }): React.JSX.Element {
	const [url, setUrl] = useState<string>();

	useEffect(() => {
		if (typeof URL.createObjectURL !== 'function') return;
		const previewUrl = URL.createObjectURL(file);
		setUrl(previewUrl);
		return () => URL.revokeObjectURL(previewUrl);
	}, [file]);

	return url ? <img src={url} alt={file.name} /> : <FileImageIcon />;
}
