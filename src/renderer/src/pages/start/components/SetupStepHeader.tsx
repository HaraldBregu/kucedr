import React from 'react';

type SetupStepHeaderProps = {
	readonly title: string;
	readonly description: string;
};

export function SetupStepHeader({ title, description }: SetupStepHeaderProps): React.JSX.Element {
	return (
		<div>
			<h1 className="text-3xl font-bold leading-tight tracking-normal text-foreground">{title}</h1>
			<p className="mt-2 w-full text-xs font-medium leading-relaxed text-muted-foreground">
				{description}
			</p>
		</div>
	);
}
