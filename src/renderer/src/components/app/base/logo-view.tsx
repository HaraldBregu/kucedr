import React from 'react';

export function LogoView({
	className = 'size-20',
}: {
	readonly className?: string;
}): React.JSX.Element {
	return (
		<span
			role="img"
			aria-label="Kucedr logo"
			className={`app-logo inline-block shrink-0 bg-[#087f5b] dark:bg-[#b7f34d] ${className}`}
		/>
	);
}
