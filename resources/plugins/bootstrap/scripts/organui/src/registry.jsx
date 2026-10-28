// Maps each catalog id to its component. Controlled components get local state seeded
// from their props, so selections and decisions work inside the static page.
import { useState } from 'react';
import { AllergyList } from '@/components/ui/allergy-list';
import { AnatomyTree } from '@/components/ui/anatomy-tree';
import { BodyMap } from '@/components/ui/body-map';
import { DermatomeMap } from '@/components/ui/dermatome-map';
import { EcgTrace, syntheticEcg } from '@/components/ui/ecg-trace';
import { GrowthChart } from '@/components/ui/growth-chart';
import { ctWindowPresets, ImageViewer } from '@/components/ui/image-viewer';
import { LabResultsTable } from '@/components/ui/lab-results';
import { MedicationSchedule } from '@/components/ui/medication-schedule';
import { News2Chart } from '@/components/ui/news2-chart';
import { PatientBanner } from '@/components/ui/patient-banner';
import { ProblemList } from '@/components/ui/problem-list';
import { VitalSigns } from '@/components/ui/vital-signs';
import { createHeadPhantom } from '@/lib/head-phantom';

// Each [value prop, change prop, default] pair becomes state. The pairs are fixed per
// component, so the hooks always run in the same order.
const stateful = (Component, pairs) =>
	function Stateful(props) {
		const state = {};
		for (const [key, onChange, initial] of pairs) {
			const [value, setValue] = useState(props[key] ?? initial);
			state[key] = value;
			state[onChange] = (next) => setValue(next);
		}
		return <Component {...props} {...state} />;
	};

export const REGISTRY = {
	'body-map': stateful(BodyMap, [['value', 'onValueChange', []]]),
	'dermatome-map': stateful(DermatomeMap, [['selectedId', 'onSelectionChange', null]]),
	'patient-banner': PatientBanner,
	'allergy-list': AllergyList,
	'problem-list': ProblemList,
	'vital-signs': VitalSigns,
	'news2-chart': News2Chart,
	'lab-results': LabResultsTable,
	'medication-schedule': stateful(MedicationSchedule, [
		['date', 'onDateChange', undefined],
		['doseStatus', 'onDoseStatusChange', {}],
	]),
	// A `synthetic` heart rate draws OrganUI's demo sinus rhythm in place of samples.
	'ecg-trace': ({ synthetic, ...props }) => (
		<EcgTrace {...props} samples={props.samples ?? syntheticEcg({ heartRate: synthetic ?? 72, sampleRate: props.sampleRate })} />
	),
	'growth-chart': GrowthChart,
	'anatomy-tree': stateful(AnatomyTree, [
		['selectedId', 'onSelectionChange', null],
		['visibility', 'onVisibilityChange', {}],
	]),
	// Without slices it shows OrganUI's synthetic head phantom with CT window presets.
	'image-viewer': (props) => (
		<ImageViewer {...(props.slices ? props : { ...createHeadPhantom(), presets: ctWindowPresets, ...props })} />
	),
};
