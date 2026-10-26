import type { PluginTool } from '../../plugins';

export function addPluginToolsPrompt(prompt: string, tools: PluginTool[]): string {
	if (tools.length === 0) return prompt;

	prompt += '\n\n## External tools';
	prompt +=
		"\nExternal tools come from installed plugins. Each one renders a visual result (for example a chart) directly in the user's view.";
	prompt +=
		'\n- Call them only through run_plugin_tool with {"name": "<tool name>", "input": {...}}. Never call a tool name directly.';
	prompt +=
		'\n- Pick the tool whose instructions match the request. If none matches, answer normally without a tool.';
	prompt +=
		"\n- Build input that matches the tool's input schema exactly. Use only real data from the conversation or tool results, never invent values.";
	prompt +=
		'\n- The result is shown to the user automatically. Do not repeat it as text or a table, add at most a one-line summary.';
	prompt +=
		'\n- If run_plugin_tool returns an error, fix the input using the error message and retry once, then report the problem.';
	prompt +=
		"\n- To put a tool's output into a markdown file, write a fenced code block whose language is the tool's fence and whose body is the same input JSON.";

	for (const tool of tools) {
		prompt += `\n\n### ${tool.name} (${tool.plugin.name} plugin)`;
		prompt += `\n${tool.description}`;
		if (tool.fence) prompt += `\nFence: ${tool.fence}`;
		prompt += `\nInput schema:\n\`\`\`json\n${JSON.stringify(tool.inputSchema)}\n\`\`\``;
		prompt += `\n${tool.instructions}`;
	}
	return prompt;
}
