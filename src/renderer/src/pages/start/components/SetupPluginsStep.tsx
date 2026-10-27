import React from 'react';
import { Download, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { STEP_COPY } from '../setupConstants';
import { SetupStepHeader } from './SetupStepHeader';

export function SetupPluginsStep(): React.JSX.Element {
	return (
		<div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center py-8">
			<SetupStepHeader
				title={STEP_COPY.plugins.title}
				description={STEP_COPY.plugins.description}
			/>
			<div className="mt-6 grid gap-3 sm:grid-cols-2">
				<Card size="sm">
					<CardHeader className="flex items-center gap-3">
						<div className="rounded-md bg-muted p-2 text-muted-foreground">
							<Package className="size-4" aria-hidden="true" />
						</div>
						<CardTitle>Built-in plugins</CardTitle>
					</CardHeader>
					<CardContent className="text-sm leading-relaxed text-muted-foreground">
						These plugins ship with Kucedr and are already installed.
					</CardContent>
				</Card>
				<Card size="sm">
					<CardHeader className="flex items-center gap-3">
						<div className="rounded-md bg-muted p-2 text-muted-foreground">
							<Download className="size-4" aria-hidden="true" />
						</div>
						<CardTitle>Download more</CardTitle>
					</CardHeader>
					<CardContent className="text-sm leading-relaxed text-muted-foreground">
						After setup, browse Settings → Plugins → Marketplace to install plugins for apps,
						MCP servers, providers, and skills.
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
