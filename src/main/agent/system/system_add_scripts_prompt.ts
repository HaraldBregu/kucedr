import path from 'node:path';
import type { PluginScriptManifest } from '../../plugins/scripts/plugin_script_read';

export function addScriptsPrompt(prompt: string, scripts: readonly PluginScriptManifest[]): string {
	if (scripts.length === 0) return prompt;
	prompt += '\n\n# Scripts';
	prompt +=
		"\n\nScripts render a visual result (charts, drawings, clinical views, dithered visuals) straight into the user's view. When a request matches a script below:\n" +
		'1. Call `load_script` with its name to load its instructions, before building the input. They list every field, the allowed values and examples.\n' +
		'2. Build `input` from real data in the conversation or tool results. Never invent numbers, dates or labels; ask if data is missing.\n' +
		"3. Call `run_script` with `{\"name\": \"<script>\", \"input\": {...}}`. The result appears in the user's view on its own: don't repeat it as text or a table, add at most a one-line summary.\n" +
		'4. If it returns an error, fix the input using the error message and retry once. If it fails again, tell the user what went wrong.\n' +
		"\nLeave out optional fields the user didn't ask for, and omit `title` unless the user wants a heading. Never call a script name as a tool of its own. To put a script's result into a markdown file, write a fenced code block whose language is the script's fence and whose body is the same input JSON.";
	for (const script of scripts) {
		const instructions = path.join(script.directory, ...script.metadata.instructions.split('/'));
		prompt += `\n- \`${script.name}\` (${script.title}) — ${script.description.replace(/\n/g, ' ')}${script.fence ? ` Fence: \`${script.fence}\`.` : ''} Instructions: \`${instructions}\``;
	}
	return prompt;
}
