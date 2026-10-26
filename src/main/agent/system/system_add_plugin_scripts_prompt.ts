import type { PluginScript } from '../../plugins';

export function addPluginScriptsPrompt(prompt: string, scripts: PluginScript[]): string {
	if (scripts.length === 0) return prompt;

	prompt += '\n\n## Plugin scripts';
	prompt +=
		"\nPlugin scripts come from installed plugins. Each one renders a visual result (for example a chart) directly in the user's view.";
	prompt +=
		'\n- Call them only through run_plugin_script with {"name": "<script name>", "input": {...}}. Never call a script name directly.';
	prompt +=
		'\n- Pick the script whose instructions match the request. If none matches, answer normally without a script.';
	prompt +=
		"\n- Build input that matches the script's input schema exactly. Use only real data from the conversation or tool results, never invent values.";
	prompt +=
		'\n- The result is shown to the user automatically. Do not repeat it as text or a table, add at most a one-line summary.';
	prompt +=
		'\n- If run_plugin_script returns an error, fix the input using the error message and retry once, then report the problem.';
	prompt +=
		"\n- To put a script's output into a markdown file, write a fenced code block whose language is the script's fence and whose body is the same input JSON.";

	for (const script of scripts) {
		prompt += `\n\n### ${script.name} (${script.plugin.name} plugin)`;
		prompt += `\n${script.description}`;
		if (script.fence) prompt += `\nFence: ${script.fence}`;
		prompt += `\nInput schema:\n\`\`\`json\n${JSON.stringify(script.inputSchema)}\n\`\`\``;
		prompt += `\n${script.instructions}`;
	}
	return prompt;
}
