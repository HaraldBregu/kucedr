import React from 'react';
import logoLight from '@resources/icons/icon.svg';
import logoDark from '@resources/icons/icon-clear.svg';

export function LogoView({
	className = 'size-20 rounded-2xl',
}: {
	readonly className?: string;
}): React.JSX.Element {
	return (
		<span className={`inline-block shrink-0 overflow-hidden ${className}`}>
			<img
				src={logoLight}
				alt="Kucedr logo"
				draggable={false}
				className="size-full object-contain dark:hidden"
			/>
			<img
				src={logoDark}
				alt="Kucedr logo"
				draggable={false}
				className="hidden size-full object-contain dark:block"
			/>
		</span>
	);
}
