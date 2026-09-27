import elkLayouts from '@mermaid-js/layout-elk';
import tidyTreeLayouts from '@mermaid-js/layout-tidy-tree';
import zenuml from '@mermaid-js/mermaid-zenuml';
import mermaid from 'mermaid';

mermaid.registerLayoutLoaders(elkLayouts);
mermaid.registerLayoutLoaders(tidyTreeLayouts);
mermaid.registerIconPacks([
	{ name: 'logos', loader: () => import('@iconify-json/logos').then((module) => module.icons) },
	{ name: 'mdi', loader: () => import('@iconify-json/mdi').then((module) => module.icons) },
]);

export const mermaidPluginsReady = mermaid.registerExternalDiagrams([zenuml]);
