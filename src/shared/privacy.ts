export interface PrivacyState {
	readonly enabled: boolean;
	readonly status: 'off' | 'connecting' | 'protected' | 'blocked';
	readonly restartRequired: boolean;
	readonly supported: boolean;
}
