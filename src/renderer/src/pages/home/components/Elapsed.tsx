import type { ReactElement } from 'react';
import { useNow } from '@/components/hooks/use-now';

export function Elapsed({ startedAtMs }: { readonly startedAtMs: number }): ReactElement {
	const now = useNow(true, 50);
	return <>{(Math.max(0, now - startedAtMs) / 1000).toFixed(3)}s</>;
}
