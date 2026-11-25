import { systemPreferences } from 'electron';
import type { LockState } from '../../shared/lock';
import { loadTranslations } from '../i18n';
import { getLanguage } from '../settings_store';
import { getLock, unlocked } from './state';

export async function unlockWithTouchId(): Promise<LockState> {
	const state = getLock();
	if (!state.locked || !state.touchId || !state.touchIdAvailable) return state;
	const { lock } = loadTranslations(getLanguage(), 'main') as unknown as {
		lock: { touchIdReason: string };
	};
	try {
		await systemPreferences.promptTouchID(lock.touchIdReason);
	} catch {
		return getLock();
	}
	return unlocked();
}
