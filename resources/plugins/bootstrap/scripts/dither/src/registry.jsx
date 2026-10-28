// Maps each catalog id to its component. `shader` is the raw engine for custom GLSL fields.
import { DitherGradient } from '@/components/dithercn/dither-gradient';
import { DitherGlow } from '@/components/dithercn/dither-glow';
import { MeshGradient } from '@/components/dithercn/mesh-gradient';
import { Aurora } from '@/components/dithercn/aurora';
import { NoiseField } from '@/components/dithercn/noise-field';
import { Waves } from '@/components/dithercn/waves';
import { Plasma } from '@/components/dithercn/plasma';
import { Beams } from '@/components/dithercn/beams';
import { Silk } from '@/components/dithercn/silk';
import { Smoke } from '@/components/dithercn/smoke';
import { Contours } from '@/components/dithercn/contours';
import { Ripples } from '@/components/dithercn/ripples';
import { Ridgelines } from '@/components/dithercn/ridgelines';
import { Metaballs } from '@/components/dithercn/metaballs';
import { Tunnel } from '@/components/dithercn/tunnel';
import { RetroGrid } from '@/components/dithercn/retro-grid';
import { Eclipse } from '@/components/dithercn/eclipse';
import { Horizon } from '@/components/dithercn/horizon';
import { Starfield } from '@/components/dithercn/starfield';
import { Halftone } from '@/components/dithercn/halftone';
import { DitherGlobe } from '@/components/dithercn/dither-globe';
import { DotMap } from '@/components/dithercn/dot-map';
import { DitherOrb } from '@/components/dithercn/dither-orb';
import { DitherFade } from '@/components/dithercn/dither-fade';
import { AreaChart } from '@/components/dithercn/area-chart';
import { BarChart } from '@/components/dithercn/bar-chart';
import { LineChart } from '@/components/dithercn/line-chart';
import { Sparkline } from '@/components/dithercn/sparkline';
import { Heatmap } from '@/components/dithercn/heatmap';
import { DonutChart } from '@/components/dithercn/donut-chart';
import { RadarChart } from '@/components/dithercn/radar-chart';
import { Gauge } from '@/components/dithercn/gauge';
import { ProgressBar } from '@/components/dithercn/progress-bar';
import { UptimeBar } from '@/components/dithercn/uptime-bar';
import { StatCard } from '@/components/dithercn/stat-card';
import { DitherButton } from '@/components/dithercn/dither-button';
import { Avatar } from '@/components/dithercn/avatar';
import { DitherCard } from '@/components/dithercn/dither-card';
import { Divider } from '@/components/dithercn/divider';
import { Skeleton } from '@/components/dithercn/skeleton';
import { Loader } from '@/components/dithercn/loader';
import { EmptyState } from '@/components/dithercn/empty-state';
import { NotFound } from '@/components/dithercn/not-found';
import { DitherText } from '@/components/dithercn/dither-text';
import { DissolveText } from '@/components/dithercn/dissolve-text';
import { ScrambleText } from '@/components/dithercn/scramble-text';
import { DitherNumber } from '@/components/dithercn/dither-number';
import { DitherImage } from '@/components/dithercn/dither-image';
import { ImageCompare } from '@/components/dithercn/image-compare';
import { ScrollRevealImage } from '@/components/dithercn/scroll-reveal-image';
import { DitheredLogo } from '@/components/dithercn/dithered-logo';
import { LogoMarquee } from '@/components/dithercn/logo-marquee';
import { DitherShader } from '@/lib/dither';

export const REGISTRY = {
	'dither-gradient': DitherGradient,
	'dither-glow': DitherGlow,
	'mesh-gradient': MeshGradient,
	'aurora': Aurora,
	'noise-field': NoiseField,
	'waves': Waves,
	'plasma': Plasma,
	'beams': Beams,
	'silk': Silk,
	'smoke': Smoke,
	'contours': Contours,
	'ripples': Ripples,
	'ridgelines': Ridgelines,
	'metaballs': Metaballs,
	'tunnel': Tunnel,
	'retro-grid': RetroGrid,
	'eclipse': Eclipse,
	'horizon': Horizon,
	'starfield': Starfield,
	'halftone': Halftone,
	'dither-globe': DitherGlobe,
	'dot-map': DotMap,
	'dither-orb': DitherOrb,
	'dither-fade': DitherFade,
	'area-chart': AreaChart,
	'bar-chart': BarChart,
	'line-chart': LineChart,
	'sparkline': Sparkline,
	'heatmap': Heatmap,
	'donut-chart': DonutChart,
	'radar-chart': RadarChart,
	'gauge': Gauge,
	'progress-bar': ProgressBar,
	'uptime-bar': UptimeBar,
	'stat-card': StatCard,
	'dither-button': DitherButton,
	'avatar': Avatar,
	'dither-card': DitherCard,
	'divider': Divider,
	'skeleton': Skeleton,
	'loader': Loader,
	'empty-state': EmptyState,
	'not-found': NotFound,
	'dither-text': DitherText,
	'dissolve-text': DissolveText,
	'scramble-text': ScrambleText,
	'dither-number': DitherNumber,
	'dither-image': DitherImage,
	'image-compare': ImageCompare,
	'scroll-reveal-image': ScrollRevealImage,
	'dithered-logo': DitheredLogo,
	'logo-marquee': LogoMarquee,
	shader: DitherShader,
};
