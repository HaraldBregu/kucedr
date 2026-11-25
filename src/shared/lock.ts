export const LOCK_IDLE_MINUTES = [0, 1, 5, 15, 30, 60] as const;

export interface LockState {
	readonly enabled: boolean;
	readonly locked: boolean;
	readonly touchId: boolean;
	readonly touchIdAvailable: boolean;
	readonly idleMinutes: number;
}

export interface LockUpdate {
	readonly enabled: boolean;
	readonly passphrase?: string;
	readonly touchId?: boolean;
	readonly idleMinutes?: number;
}
