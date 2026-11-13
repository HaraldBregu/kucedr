import type { CodingHarness, HarnessOptions } from './types';
import { AppServerHarness } from './app_server';

export const HARNESS_PROTOCOLS: Readonly<
	Record<string, (options: HarnessOptions) => CodingHarness>
> = {
	'app-server': (options) => new AppServerHarness(options),
};
