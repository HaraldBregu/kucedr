import { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { isRemoteUrl } from '@/lib/remote';

export function RemoteImage({ src, alt }: { readonly src?: string; readonly alt?: string }): React.JSX.Element {
	const { t } = useTranslation();
	const [loaded, setLoaded] = useState<{ src: string; data: string }>();
	const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle');
	if (!src || !isRemoteUrl(src)) return <img src={src} alt={alt ?? ''} />;
	if (loaded?.src === src) return <img src={loaded.data} alt={alt ?? ''} />;
	const load = (): void => {
		setState('loading');
		void window.app.remoteImage(src).then(
			(data) => {
				setLoaded({ src, data });
				setState('idle');
			},
			() => setState('failed')
		);
	};
	return (
		<Button type="button" variant="secondary" size="sm" title={src} disabled={state === 'loading'} onClick={load}>
			<ImageIcon />
			{state === 'failed' ? t('remoteImage.failed', 'Image unavailable, try again') : t('remoteImage.load', 'Load image')}
		</Button>
	);
}
