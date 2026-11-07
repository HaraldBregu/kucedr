import * as React from 'react';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
	const [isMobile, setIsMobile] = React.useState(() => window.innerWidth < breakpoint);

	React.useEffect(() => {
		const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
		const onChange = () => {
			setIsMobile(window.innerWidth < breakpoint);
		};
		onChange();
		mql.addEventListener('change', onChange);
		return () => mql.removeEventListener('change', onChange);
	}, [breakpoint]);

	return isMobile;
}
