import { Copy, Download, MoreHorizontal, MoveHorizontal, Search } from 'lucide-react';
import { marked } from 'marked';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface WorkspaceViewActionsProps {
	readonly wide: boolean;
	readonly onWideChange: (wide: boolean) => void;
	readonly onFind: () => void;
	readonly name: string;
	readonly content: string;
	readonly markdown: boolean;
}

export function WorkspaceViewActions({ wide, onWideChange, onFind, name, content, markdown }: WorkspaceViewActionsProps): React.JSX.Element {
	const base = name.replace(/\.[^.]+$/, '') || 'document';
	const html = (): string => `<!doctype html><html><head><meta charset="utf-8"><title>${base}</title><style>body{font-family:-apple-system,system-ui,sans-serif;line-height:1.6;max-width:760px;margin:2rem auto;padding:0 1rem;color:#111}a{color:#2563eb}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:4px 8px;text-align:left}pre{background:#f4f4f5;padding:8px;border-radius:6px;overflow:auto}img{max-width:100%}</style></head><body>${marked.parse(content, { async: false })}</body></html>`;
	return (
		<div className="ml-auto flex items-center gap-0.5">
			<Tooltip>
				<TooltipTrigger render={
					<Button type="button" variant="ghost" size="icon-sm" aria-label="Find in file" className="text-muted-foreground" onMouseDown={(event) => event.preventDefault()} onClick={onFind}>
						<Search />
					</Button>
				} />
				<TooltipContent side="bottom">Find in file</TooltipContent>
			</Tooltip>
			{markdown ? <Tooltip>
				<TooltipTrigger render={
					<Button type="button" variant="ghost" size="icon-sm" aria-label="Full width" aria-pressed={wide} className={wide ? 'bg-muted text-foreground' : 'text-muted-foreground'} onMouseDown={(event) => event.preventDefault()} onClick={() => onWideChange(!wide)}>
						<MoveHorizontal />
					</Button>
				} />
				<TooltipContent side="bottom">Full width</TooltipContent>
			</Tooltip> : null}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button type="button" variant="ghost" size="icon-sm" aria-label="More actions" className="text-muted-foreground" onMouseDown={(event) => event.preventDefault()}>
						<MoreHorizontal />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onSelect={() => void navigator.clipboard.writeText(content)}><Copy />Copy</DropdownMenuItem>
					{markdown ? <DropdownMenuItem onSelect={() => {
						const rich = html();
						void navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([rich], { type: 'text/html' }), 'text/plain': new Blob([content], { type: 'text/plain' }) })]);
					}}><Copy />Copy as formatted text</DropdownMenuItem> : null}
					{markdown ? <>
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={() => void window.app.exportDocument(base, 'md', content)}><Download />Export as Markdown</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => void window.app.exportDocument(base, 'html', html())}><Download />Export as formatted text (HTML)</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => void window.app.exportDocument(base, 'pdf', html())}><Download />Export as PDF</DropdownMenuItem>
					</> : null}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
