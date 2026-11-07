import * as React from 'react';

const MOBILE_QUERY = '(max-width: 767px)';

export function useIsMobile(query = MOBILE_QUERY) {
	const [isMobile, setIsMobile] = React.useState(() => window.matchMedia(query).matches);

	React.useEffect(() => {
		const mql = window.matchMedia(query);
		const onChange = () => {
			setIsMobile(mql.matches);
		};
		onChange();
		mql.addEventListener('change', onChange);
		return () => mql.removeEventListener('change', onChange);
	}, [query]);

	return isMobile;
}
