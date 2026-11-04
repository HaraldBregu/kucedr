import type { ReactElement } from 'react';
import { useNow } from '@/components/hooks/use-now';

export function Elapsed({ startedAtMs }: { readonly startedAtMs: number }): ReactElement {
	const now = useNow(true, 50);
	const tenths = Math.floor(Math.max(0, now - startedAtMs) / 100);
	const minutes = Math.floor(tenths / 600);
	const seconds = ((tenths % 600) / 10).toFixed(1);
	return <>{minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`}</>;
}
