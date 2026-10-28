import { Extension } from '@tiptap/core';
import type { Node } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

interface SearchState {
	readonly query: string;
	readonly matches: { from: number; to: number }[];
}

export const searchKey = new PluginKey<SearchState>('workspaceSearch');

function findMatches(doc: Node, query: string): SearchState['matches'] {
	const matches: SearchState['matches'] = [];
	if (!query) return matches;
	const needle = query.toLocaleLowerCase();
	doc.descendants((node, pos) => {
		if (!node.isTextblock) return true;
		const text = node.textBetween(0, node.content.size, undefined, '￼').toLocaleLowerCase();
		for (let index = text.indexOf(needle); index !== -1; index = text.indexOf(needle, index + needle.length)) {
			matches.push({ from: pos + 1 + index, to: pos + 1 + index + needle.length });
		}
		return false;
	});
	return matches;
}

export const WorkspaceSearch = Extension.create<{ onMatchCount: (count: number) => void }>({
	name: 'workspaceSearch',
	addOptions() {
		return { onMatchCount: () => undefined };
	},
	addProseMirrorPlugins() {
		const { onMatchCount } = this.options;
		return [
			new Plugin<SearchState>({
				key: searchKey,
				state: {
					init: () => ({ query: '', matches: [] }),
					apply(tr, value, _old, state) {
						const query = (tr.getMeta(searchKey) as string | undefined) ?? value.query;
						if (query === value.query && !tr.docChanged) return value;
						return { query, matches: findMatches(state.doc, query) };
					},
				},
				props: {
					decorations(state) {
						const { from, to } = state.selection;
						return DecorationSet.create(state.doc, (searchKey.getState(state)?.matches ?? []).map((match) => Decoration.inline(match.from, match.to, {
							class: match.from === from && match.to === to ? 'rounded-sm bg-primary/70 text-primary-foreground' : 'rounded-sm bg-primary/20',
						})));
					},
				},
				view: () => ({
					update: (view) => onMatchCount(searchKey.getState(view.state)?.matches.length ?? 0),
				}),
			}),
		];
	},
});
