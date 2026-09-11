import React from 'react';
import mark from '@resources/icons/icon-clear.svg';

export function LogoView({
	className = 'size-20 rounded-2xl',
}: {
	readonly className?: string;
}): React.JSX.Element {
	return <img src={mark} alt="Kucedr logo" className={`object-contain dark:invert ${className}`} />;
}
