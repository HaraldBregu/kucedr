import { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { isRemoteUrl } from '@/lib/remote';

export function RemoteImage({ src, alt }: { readonly src?: string; readonly alt?: string }): React.JSX.Element {
	const { t } = useTranslation();
	const [loaded, setLoaded] = useState(false);
	if (loaded || !src || !isRemoteUrl(src)) return <img src={src} alt={alt ?? ''} />;
	return (
		<Button type="button" variant="secondary" size="sm" title={src} onClick={() => setLoaded(true)}>
			<ImageIcon />
			{t('remoteImage.load', 'Load image')}
		</Button>
	);
}
