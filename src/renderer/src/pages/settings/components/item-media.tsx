import React from 'react';
import { ItemMedia } from '@/components/ui/item';

export function SettingsItemMedia({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
	return (
		<ItemMedia variant="icon" className="size-10 shrink-0 rounded-2xl bg-muted/50 [&>svg]:size-5 [&>svg]:text-foreground">
			{children}
		</ItemMedia>
	);
}
