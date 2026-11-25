import { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { isRemoteUrl } from '@/lib/remote';

export function RemoteImage({ src, alt }: { readonly src?: string; readonly alt?: string }): React.JSX.Element {
	const { t } = useTranslation();
	const [loadedSrc, setLoadedSrc] = useState<string>();
	if (loadedSrc === src || !src || !isRemoteUrl(src)) return <img src={src} alt={alt ?? ''} />;
	return (
		<Button type="button" variant="secondary" size="sm" title={src} onClick={() => setLoadedSrc(src)}>
			<ImageIcon />
			{t('remoteImage.load', 'Load image')}
		</Button>
	);
}
