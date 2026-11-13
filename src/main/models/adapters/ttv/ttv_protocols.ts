import { createAsyncVideoAdapter } from './ttv_async';
import { createGenerationsVideoAdapter } from './ttv_generations';
import { createInteractionsVideoAdapter } from './ttv_interactions';
import { createJobsVideoAdapter } from './ttv_jobs';
import { createJwtVideoAdapter } from './ttv_jwt';
import { createOperationsVideoAdapter } from './ttv_operations';
import { createPollingVideoAdapter } from './ttv_polling';
import { createSyncVideoAdapter } from './ttv_sync';
import { createSynthesisVideoAdapter } from './ttv_synthesis';
import { createTaskVideoAdapter } from './ttv_task';
import { createVersionedVideoAdapter } from './ttv_versioned';
import { createVideoGenerationAdapter } from './ttv_videogen';
import { createVideosAdapter } from './ttv_videos';
import type { VideoAdapter, VideoProviderSpec } from './ttv_types';

export const VIDEO_PROTOCOLS: Readonly<Record<string, (spec: VideoProviderSpec) => VideoAdapter>> =
	{
		videos: createVideosAdapter,
		'videos-async': createAsyncVideoAdapter,
		'polling-url': createPollingVideoAdapter,
		'long-running': createOperationsVideoAdapter,
		interactions: createInteractionsVideoAdapter,
		task: createTaskVideoAdapter,
		'jwt-task': createJwtVideoAdapter,
		generations: createGenerationsVideoAdapter,
		'video-generation': (spec) => createVideoGenerationAdapter(spec, false),
		'video-generation-content': (spec) => createVideoGenerationAdapter(spec, true),
		jobs: createJobsVideoAdapter,
		sync: createSyncVideoAdapter,
		'video-synthesis': createSynthesisVideoAdapter,
		'versioned-tasks': createVersionedVideoAdapter,
	};
