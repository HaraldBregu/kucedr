import { Brief } from './components/brief';
import { Canvas } from './components/canvas';
import { Header } from './components/header';
import { Versions } from './components/versions';
import { useStudio } from './studio';
import { useTheme } from './theme';

export default function App() {
	useTheme();
	const studio = useStudio();
	return (
		<div className="architect">
			<Header
				model={studio.modelLabel}
				connected={studio.connected}
				hasImage={Boolean(studio.current)}
				onReset={studio.reset}
			/>
			<main className="workspace">
				<Brief
					brief={studio.brief}
					disabled={Boolean(studio.busy)}
					connected={studio.connected}
					onChange={studio.updateBrief}
					onGenerate={() => void studio.generate()}
					onImport={(file) => void studio.importFile(file)}
				/>
				<Canvas
					current={studio.current}
					busy={studio.busy}
					message={studio.message}
					cropMode={studio.cropMode}
					crop={studio.crop}
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
		</div>
	);
}
