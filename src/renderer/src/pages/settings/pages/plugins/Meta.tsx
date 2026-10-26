import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface Props {
	readonly rows: readonly {
		readonly key: string;
		readonly title: string;
		readonly icon: LucideIcon;
		readonly value?: string;
	}[];
}

export default function Meta({ rows }: Props): React.JSX.Element {
	return (
		<dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
			{rows.map((row) => (
				<div key={row.key} className="flex items-center gap-1.5" title={row.title}>
					<dt className="text-muted-foreground">
						<row.icon className="size-4" />
						<span className="sr-only">{row.title}</span>
					</dt>
					<dd className={row.key === 'id' ? 'font-mono text-foreground' : 'text-foreground'}>
						{row.value}
					</dd>
				</div>
			))}
		</dl>
	);
}
