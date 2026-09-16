import { useEffect, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Brief } from './components/brief';
import { Canvas } from './components/canvas';
import { Header } from './components/header';
import { Versions } from './components/versions';
import { useStudio } from './studio';
import { useTheme } from './theme';

export default function App() {
	useTheme();
	const studio = useStudio();
	const [sidebarOpen, setSidebarOpen] = useState(true);
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent): void => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
				event.preventDefault();
				setSidebarOpen((open) => !open);
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, []);
	return (
		<div className="architect">
			<button
				type="button"
				className="sidebar-trigger"
				aria-controls="architect-sidebar"
				aria-expanded={sidebarOpen}
				aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
				title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
				onClick={() => setSidebarOpen((open) => !open)}
			>
				{sidebarOpen ? <PanelLeftClose size={16} strokeWidth={1.5} /> : <PanelLeftOpen size={16} strokeWidth={1.5} />}
			</button>
			<div className={sidebarOpen ? 'sidebar-spacer' : 'sidebar-spacer collapsed'} />
			<aside id="architect-sidebar" className={sidebarOpen ? 'architect-sidebar' : 'architect-sidebar collapsed'}>
				<div className="sidebar-drag" />
				<div className="sidebar-brand">Architect</div>
				<nav className="sidebar-nav" aria-label="Architect navigation">
					<a className="selected" href="#brief">Design brief</a>
					<a href="#canvas">Canvas</a>
					<a href="#concepts">Concept history</a>
				</nav>
				<Brief
				brief={studio.brief}
					disabled={Boolean(studio.busy)}
					connected={studio.connected}
				onChange={studio.updateBrief}
					onDisciplineChange={studio.selectDiscipline}
					onGenerate={() => void studio.generate()}
					onImport={(file) => void studio.importFile(file)}
				/>
			</aside>
			<section className="architect-inset">
				<Header
					model={studio.modelLabel}
					connected={studio.connected}
					hasImage={Boolean(studio.current)}
					onReset={studio.reset}
					sidebarOpen={sidebarOpen}
				/>
				<main className="workspace">
				<Canvas
					current={studio.current}
					busy={studio.busy}
					message={studio.message}
				cropMode={studio.cropMode}
				crop={studio.crop}
				discipline={studio.brief.discipline}
					onCrop={() => studio.setCropMode(!studio.cropMode)}
					onDownload={studio.download}
					onRevise={studio.revise}
				/>
				<Versions
					versions={studio.versions}
					currentId={studio.currentId}
					cropMode={studio.cropMode}
					crop={studio.crop}
					busy={Boolean(studio.busy)}
					onSelect={studio.selectVersion}
					onChange={studio.updateCrop}
					onApply={() => void studio.applyCrop()}
					onCancel={() => studio.setCropMode(false)}
				/>
			</main>
			</section>
		</div>
	);
}
