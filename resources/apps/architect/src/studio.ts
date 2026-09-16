import { useEffect, useMemo, useState } from 'react';
import { app, isKucedr, models, type CatalogModel, type ImageResult } from '@kucedr/sdk';
import { buildBriefPrompt } from './brief';
import { cropImage } from './crop';
import { selectGenerationModel } from './generation';
import { selectEditModel } from './model';
import { createGenerationOptions } from './options';
import { readImage } from './read';
import { buildRevisionPrompt } from './revision';
import type { CropSettings, DesignDiscipline, GenerationBrief, StudioController } from './types';
import { createVersion } from './version';

const initialBrief: GenerationBrief = {
	discipline: 'interior',
	description: '',
	subject: 'living room',
	context: 'a calm private residence with a garden view',
	style: 'warm contemporary minimalism',
	materials: 'natural oak, honed limestone, linen, and brushed metal',
	lighting: 'soft late-afternoon daylight with warm indirect lighting',
	ratio: '16:9',
};

const initialCrop: CropSettings = { ratio: 'original', zoom: 1, x: 0, y: 0 };

export function useStudio(): StudioController {
	const connected = isKucedr();
	const [brief, setBrief] = useState(initialBrief);
	const [crop, setCrop] = useState(initialCrop);
	const [cropMode, setCropMode] = useState(false);
	const [versions, setVersions] = useState<ReturnType<typeof createVersion>[]>([]);
	const [currentId, setCurrentId] = useState<string>();
	const [catalog, setCatalog] = useState<CatalogModel[]>([]);
	const [providerId, setProviderId] = useState('google');
	const [modelId, setModelId] = useState<string>();
	const [busy, setBusy] = useState<string>();
	const [message, setMessage] = useState(
		connected
			? 'Ready to develop an interior, exterior, or industrial design concept.'
			: 'Open this app in Kucedr to generate images.'
	);

	useEffect(() => {
		if (!connected) return;
		let active = true;
		void Promise.all([app.models(), models.image.getProviderId(), models.image.getModelId()])
			.then(([available, selectedProvider, selectedModel]) => {
				if (!active) return;
				setCatalog(available);
				setProviderId(selectedProvider ?? 'google');
				setModelId(selectedModel);
			})
			.catch((error) => active && setMessage((error as Error).message));
		return () => {
			active = false;
		};
	}, [connected]);

	const current = versions.find((version) => version.id === currentId) ?? versions[0];
	const generationModel = useMemo(
		() => selectGenerationModel(catalog, providerId, modelId),
		[catalog, modelId, providerId]
	);
	const modelLabel = generationModel
		? `${generationModel.provider.name} · ${generationModel.name}`
		: providerId;

	const append = (result: ImageResult, label: string, prompt: string): void => {
		const version = createVersion(result, label, prompt);
		setVersions((items) => [version, ...items].slice(0, 12));
		setCurrentId(version.id);
	};

	const generate = async (): Promise<void> => {
		if (!connected) return setMessage('Open Architect in Kucedr to use the configured image model.');
		if (!brief.description.trim()) return setMessage('Describe the space you want to create.');
		const prompt = buildBriefPrompt(brief);
		setBusy(`Generating ${brief.discipline} design concept…`);
		setMessage(`Kucedr is translating the brief into a finished ${brief.discipline} design.`);
		try {
			const result = await models.image.createImage({
				prompt,
				...(generationModel
					? {
							providerId: generationModel.provider.id,
							modelId: generationModel.id,
							options: createGenerationOptions(generationModel, brief),
						}
					: {}),
			});
			append(result, `Generated ${brief.discipline} concept`, brief.description.trim());
			setMessage('Concept ready. Crop it or describe the next design revision.');
		} catch (error) {
			setMessage((error as Error).message);
		} finally {
			setBusy(undefined);
		}
	};

	const importFile = async (file: File): Promise<void> => {
		try {
			const result = await readImage(file);
			append(result, 'Imported reference', file.name);
			setMessage('Reference ready. Crop it or describe the next design revision.');
		} catch (error) {
			setMessage((error as Error).message);
		}
	};

	const revise = async (instruction: string): Promise<void> => {
		if (!connected) return setMessage('Open Architect in Kucedr to revise images with AI.');
		if (!current) return setMessage('Generate or import an image first.');
		if (!instruction.trim()) return setMessage('Describe the design revision.');
		const editModel = selectEditModel(catalog, providerId, modelId);
		if (!editModel) {
			return setMessage(
				'Your configured image provider has no compatible edit model. Choose Google, BFL Kontext, or Qwen Image Edit in Kucedr Settings.'
			);
		}
		const prompt = buildRevisionPrompt(instruction, brief.discipline);
		setBusy('Revising the current design…');
		setMessage(`Preserving the composition with ${editModel.name}.`);
		try {
			const result = await models.image.createImage({
				providerId: editModel.provider.id,
				modelId: editModel.id,
				prompt,
				source: { base64: current.base64, mimeType: current.mimeType },
			});
			append(result, 'AI revision', instruction.trim());
			setMessage('Revision ready. The previous version remains in Versions.');
		} catch (error) {
			setMessage((error as Error).message);
		} finally {
			setBusy(undefined);
		}
	};

	const applyCrop = async (): Promise<void> => {
		if (!current) return;
		setBusy('Applying crop…');
		try {
			append(await cropImage(current.url, crop), 'Cropped version', crop.ratio);
			setCropMode(false);
			setCrop(initialCrop);
			setMessage('Crop applied as a new version.');
		} catch (error) {
			setMessage((error as Error).message);
		} finally {
			setBusy(undefined);
		}
	};

	return {
		connected,
		brief,
		crop,
		cropMode,
		current,
		currentId,
		versions,
		busy,
		message,
		modelLabel,
		catalog,
		updateBrief: (field, value) => setBrief((valueBefore) => ({ ...valueBefore, [field]: value })),
		selectDiscipline: (discipline: DesignDiscipline) =>
			setBrief((valueBefore) => ({
				...valueBefore,
				discipline,
				subject:
					discipline === 'interior'
						? 'living room'
						: discipline === 'exterior'
							? 'private residence'
							: 'lounge chair',
				context:
					discipline === 'interior'
						? 'a calm private residence with a garden view'
						: discipline === 'exterior'
							? 'a wooded site with a generous approach'
							: 'a studio setting with clear human scale',
			})),
		updateCrop: (field, value) => setCrop((valueBefore) => ({ ...valueBefore, [field]: value })),
		generate,
		importFile,
		revise,
		applyCrop,
		setCropMode,
		selectVersion: setCurrentId,
		download: () => {
			if (!current) return;
			const link = document.createElement('a');
			link.href = current.url;
			link.download = `architect-${new Date(current.createdAt).toISOString().slice(0, 19).replaceAll(':', '-')}.${current.mimeType.split('/')[1]}`;
			link.click();
		},
		reset: () => {
			setVersions([]);
			setCurrentId(undefined);
			setCropMode(false);
			setMessage('Ready for a new design brief.');
		},
	};
}
