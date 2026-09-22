const INHERITED = /^(?:PATH|HOME|USER|LOGNAME|LANG|LC_[A-Z_]+|TERM|COLORTERM|TMPDIR|TMP|TEMP|SystemRoot|WINDIR|ComSpec|PATHEXT|APPDATA|LOCALAPPDATA|USERPROFILE)$/i;
const BOOTSTRAP = /^(?:NODE_OPTIONS|NODE_PATH|ELECTRON_RUN_AS_NODE|ELECTRON_NO_ASAR|LD_.*|DYLD_.*|BASH_ENV|ENV|SHELLOPTS|BASHOPTS|ZDOTDIR)$/i;

export function commandEnvironment(input: Record<string, string> = {}, inherited: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
	const result: NodeJS.ProcessEnv = {};
	for (const [key, value] of Object.entries(inherited)) {
		if (INHERITED.test(key) && !BOOTSTRAP.test(key)) result[key] = value;
	}
	for (const [key, value] of Object.entries(input)) {
		if (BOOTSTRAP.test(key)) throw new Error(`Command environment cannot override bootstrap variable ${key}.`);
		result[key] = value;
	}
	return result;
}
