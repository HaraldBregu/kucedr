import React from 'react';
import mark from '@resources/icons/icon-clear.svg';

export function LogoView({
	className = 'size-20 rounded-2xl',
}: {
	readonly className?: string;
}): React.JSX.Element {
	return (
		<span
			role="img"
			aria-label="Kucedr logo"
			className={`inline-block bg-[#087f5b] dark:bg-[#b7f34d] ${className}`}
			style={{
				WebkitMask: `url(${mark}) center / contain no-repeat`,
				mask: `url(${mark}) center / contain no-repeat`,
			}}
		/>
	);
}
