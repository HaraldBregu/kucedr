import type { ComponentProps, ReactElement } from 'react';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

import { useIsDark } from '@/hooks/use-is-dark';
import { cn } from '@/lib/utils';

export type PersonaState = 'idle' | 'listening' | 'thinking' | 'speaking';

type PersonaProps = Omit<ComponentProps<'div'>, 'children'> & {
	readonly level?: number;
	readonly size?: number;
	readonly state?: PersonaState;
};

const RING_COUNT = 6;
const SEGMENT_COUNT = 280;
const TAU = Math.PI * 2;
const LISTENING_RINGS = [
	{ radius: 0.39, opacity: 0.98, width: 1.35 },
	{ radius: 0.445, opacity: 0.62, width: 0.75 },
	{ radius: 0.492, opacity: 0.48, width: 0.68 },
	{ radius: 0.535, opacity: 0.35, width: 0.6 },
	{ radius: 0.58, opacity: 0.24, width: 0.55 },
] as const;
const SPEAKING_RINGS = [
	{ radius: 0.405, opacity: 0.98, width: 1.25, offsetY: 0, wobble: 0.004, response: 0.012 },
	{ radius: 0.414, opacity: 0.68, width: 0.82, offsetY: 0.004, wobble: 0.005, response: 0.017 },
	{ radius: 0.422, opacity: 0.46, width: 0.72, offsetY: -0.004, wobble: 0.006, response: 0.019 },
	{ radius: 0.43, opacity: 0.26, width: 0.62, offsetY: 0.003, wobble: 0.006, response: 0.022 },
	{ radius: 0.438, opacity: 0.17, width: 0.56, offsetY: -0.003, wobble: 0.007, response: 0.024 },
	{ radius: 0.446, opacity: 0.11, width: 0.5, offsetY: 0.002, wobble: 0.0075, response: 0.026 },
] as const;

export function Persona({
	className,
	level = 0.16,
	size = 260,
	state = 'idle',
	style,
	...props
}: PersonaProps): ReactElement {
	const mountRef = useRef<HTMLDivElement>(null);
	const stateRef = useRef(state);
	const levelRef = useRef(Number.isFinite(level) ? THREE.MathUtils.clamp(level, 0, 1) : 0);

	useEffect(() => {
		stateRef.current = state;
	}, [state]);

	useEffect(() => {
		levelRef.current = Number.isFinite(level) ? THREE.MathUtils.clamp(level, 0, 1) : 0;
	}, [level]);

	useEffect(() => {
		const container = mountRef.current;
		if (!container) return;

		const scene = new THREE.Scene();
		const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
		camera.position.z = 2;

		let renderer: THREE.WebGLRenderer;
		try {
			renderer = new THREE.WebGLRenderer({
				alpha: true,
				antialias: true,
				powerPreference: 'high-performance',
			});
		} catch {
			return;
		}

		renderer.setClearColor(0x000000, 0);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.domElement.style.display = 'block';
		renderer.domElement.style.height = '100%';
		renderer.domElement.style.width = '100%';
		container.appendChild(renderer.domElement);

		const orb = new THREE.Group();
		scene.add(orb);

		const rings = Array.from({ length: RING_COUNT }, (_, index) => {
			const geometry = new LineGeometry();
			geometry.setPositions(new Float32Array((SEGMENT_COUNT + 1) * 3));
			const positionBuffer = (
				geometry.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute
			).data;
			const material = [
				new LineMaterial({
					blending: THREE.AdditiveBlending,
					color: 0xffffff,
					depthTest: false,
					depthWrite: false,
					linewidth: 1.3,
					opacity: 1,
					transparent: true,
					worldUnits: false,
				}),
				new LineMaterial({
					blending: THREE.AdditiveBlending,
					color: 0xffffff,
					depthTest: false,
					depthWrite: false,
					linewidth: 5.2,
					opacity: 0.12,
					transparent: true,
					worldUnits: false,
				}),
				new LineMaterial({
					blending: THREE.AdditiveBlending,
					color: 0xffffff,
					depthTest: false,
					depthWrite: false,
					linewidth: 11.7,
					opacity: 0.035,
					transparent: true,
					worldUnits: false,
				}),
			];
			const lines = material.map((item) => new Line2(geometry, item));
			lines.forEach((line) => {
				line.frustumCulled = false;
			});
			const group = new THREE.Group();
			group.add(lines[2], lines[1], lines[0]);
			orb.add(group);

			return {
				current: {
					arcLength: TAU,
					arcStart: 0,
					offsetX: 0,
					offsetY: 0,
					opacity: index === 0 ? 1 : 0,
					radius: 0.415 + index * 0.035,
					rotation: 0,
					scaleX: 1,
					scaleY: 1,
					width: index === 0 ? 1.3 : 0.7,
					wobble: 0,
				},
				geometry,
				glow: 1,
				lobes: 3,
				material,
				phase: index * 0.91 + 0.17,
				positionBuffer,
				speed: 0.6,
				target: {
					arcLength: TAU,
					arcStart: 0,
					breath: 0,
					offsetX: 0,
					offsetY: 0,
					opacity: index === 0 ? 1 : 0,
					radius: 0.415 + index * 0.035,
					rotation: 0,
					scaleX: 1,
					scaleY: 1,
					width: index === 0 ? 1.3 : 0.7,
					wobble: 0,
				},
			};
		});

		let configuredState: PersonaState | null = null;
		let enteredAt = performance.now() / 1000;
		let lastFrame = enteredAt;
		let smoothedLevel = THREE.MathUtils.clamp(levelRef.current, 0, 1);

		const resizeObserver = new ResizeObserver(() => {
			const width = Math.max(1, container.clientWidth);
			const height = Math.max(1, container.clientHeight);
			const aspect = width / height;

			renderer.setSize(width, height, false);
			if (aspect >= 1) {
				camera.left = -aspect;
				camera.right = aspect;
				camera.top = 1;
				camera.bottom = -1;
			} else {
				camera.left = -1;
				camera.right = 1;
				camera.top = 1 / aspect;
				camera.bottom = -1 / aspect;
			}
			camera.updateProjectionMatrix();

			const pixelRatio = renderer.getPixelRatio();
			rings.forEach((ring) => {
				ring.material.forEach((material) =>
					material.resolution.set(width * pixelRatio, height * pixelRatio)
				);
			});
		});
		resizeObserver.observe(container);

		renderer.setAnimationLoop((nowMs) => {
			const now = nowMs / 1000;
			const delta = THREE.MathUtils.clamp(now - lastFrame, 0.001, 0.05);
			lastFrame = now;

			const activeState = stateRef.current;
			if (configuredState !== activeState) {
				configuredState = activeState;
				enteredAt = now;

				rings.forEach((ring) => {
					Object.assign(ring.target, {
						arcLength: TAU,
						arcStart: 0,
						breath: 0,
						offsetX: 0,
						offsetY: 0,
						opacity: 0,
						rotation: 0,
						scaleX: 1,
						scaleY: 1,
						wobble: 0,
					});
				});

				if (activeState === 'idle') {
					Object.assign(rings[0].target, {
						breath: 0.006,
						opacity: 0.98,
						radius: 0.415,
						width: 1.35,
						wobble: 0.0018,
					});
					rings[0].glow = 1;
					rings[0].lobes = 3;
					rings[0].speed = 0.55;
				}

				if (activeState === 'listening') {
					LISTENING_RINGS.forEach(({ radius, opacity, width }, index) => {
						Object.assign(rings[index].target, {
							breath: 0.004 + index * 0.0015,
							opacity,
							radius,
							width,
							wobble: 0.0015 + index * 0.0008,
						});
						rings[index].glow = index === 0 ? 1 : 0.45;
						rings[index].lobes = 3 + index;
						rings[index].speed = 1.1 + index * 0.22;
					});
				}

				if (activeState === 'thinking') {
					Object.assign(rings[0].target, {
						arcLength: TAU - 0.34,
						arcStart: 0.17,
						breath: 0.002,
						opacity: 0.94,
						radius: 0.405,
						width: 1.25,
						wobble: 0.0032,
					});
					Object.assign(rings[1].target, {
						arcLength: Math.PI * 1.26,
						arcStart: Math.PI * 0.92,
						offsetX: 0.005,
						offsetY: 0.002,
						opacity: 0.8,
						radius: 0.43,
						scaleX: 1.1,
						scaleY: 0.93,
						width: 0.82,
						wobble: 0.004,
					});
					Object.assign(rings[2].target, {
						arcLength: Math.PI * 1.1,
						arcStart: -Math.PI * 0.08,
						offsetX: -0.002,
						offsetY: -0.002,
						opacity: 0.48,
						radius: 0.438,
						scaleX: 1.13,
						scaleY: 0.92,
						width: 0.7,
						wobble: 0.003,
					});
					rings[0].lobes = 2;
					rings[1].lobes = 3;
					rings[2].lobes = 2;
					rings[0].glow = 0.9;
					rings[1].glow = 0.45;
					rings[2].glow = 0.3;
					rings[0].speed = 1.1;
					rings[1].speed = 1.5;
					rings[2].speed = 1.8;
				}

				if (activeState === 'speaking') {
					SPEAKING_RINGS.forEach(({ radius, opacity, width, offsetY, wobble }, index) => {
						Object.assign(rings[index].target, {
							breath: 0.003 + index * 0.001,
							offsetX: index % 2 ? 0.0025 : -0.002,
							offsetY,
							opacity,
							radius,
							scaleX: 1 + index * 0.004,
							scaleY: 1 - index * 0.003,
							width,
							wobble,
						});
						rings[index].glow = index === 0 ? 0.9 : index < 4 ? 0.35 : 0.25;
						rings[index].lobes = 3 + index;
						rings[index].speed = 2.4 + index * 0.55;
					});
				}
			}

			const requestedLevel = THREE.MathUtils.clamp(levelRef.current, 0, 1);
			const levelEase = 1 - Math.exp(-delta * (requestedLevel > smoothedLevel ? 18 : 5));
			smoothedLevel = THREE.MathUtils.lerp(smoothedLevel, requestedLevel, levelEase);
			const age = now - enteredAt;

			if (activeState === 'listening') {
				LISTENING_RINGS.forEach(({ radius, opacity }, index) => {
					const pulse = (Math.sin(age * 2.8 - index * 0.9) + 1) * 0.5;
					const direction = index % 2 === 0 ? 1 : -1;
					rings[index].target.radius =
						radius + smoothedLevel * (0.018 + index * 0.008) + pulse * (0.004 + index * 0.003);
					rings[index].target.opacity = opacity * (0.76 + pulse * 0.24);
					rings[index].target.rotation = direction * age * (0.05 + index * 0.014);
					rings[index].target.wobble =
						0.0015 + index * 0.0008 + smoothedLevel * (0.003 + index * 0.0008);
					rings[index].glow = index === 0 ? 1 : 0.4 + pulse * 0.2;
				});
			}

			if (activeState === 'thinking') {
				rings[0].target.rotation = Math.sin(age * 0.7) * 0.05;
				rings[1].target.rotation = age * 0.32;
				rings[2].target.rotation = -age * 0.24;
			}

			if (activeState === 'speaking') {
				const syntheticLevel = 0.22 + 0.14 * Math.sin(now * 3.1) + 0.08 * Math.sin(now * 7.7);
				const energy = Math.max(smoothedLevel, syntheticLevel);
				SPEAKING_RINGS.forEach(({ wobble, response }, index) => {
					rings[index].target.wobble = wobble + energy * response;
				});
			}

			const transitionEase = 1 - Math.exp(-delta * 8);
			rings.forEach((ring) => {
				const current = ring.current;
				const target = ring.target;
				current.arcLength = THREE.MathUtils.lerp(
					current.arcLength,
					target.arcLength,
					transitionEase
				);
				current.arcStart = THREE.MathUtils.lerp(current.arcStart, target.arcStart, transitionEase);
				current.offsetX = THREE.MathUtils.lerp(current.offsetX, target.offsetX, transitionEase);
				current.offsetY = THREE.MathUtils.lerp(current.offsetY, target.offsetY, transitionEase);
				current.opacity = THREE.MathUtils.lerp(current.opacity, target.opacity, transitionEase);
				current.radius = THREE.MathUtils.lerp(current.radius, target.radius, transitionEase);
				current.rotation = THREE.MathUtils.lerp(current.rotation, target.rotation, transitionEase);
				current.scaleX = THREE.MathUtils.lerp(current.scaleX, target.scaleX, transitionEase);
				current.scaleY = THREE.MathUtils.lerp(current.scaleY, target.scaleY, transitionEase);
				current.width = THREE.MathUtils.lerp(current.width, target.width, transitionEase);
				current.wobble = THREE.MathUtils.lerp(current.wobble, target.wobble, transitionEase);

				ring.material[0].opacity = current.opacity;
				ring.material[0].linewidth = current.width;
				ring.material[1].opacity = current.opacity * 0.12 * ring.glow;
				ring.material[1].linewidth = current.width * 4.2;
				ring.material[2].opacity = current.opacity * 0.035 * ring.glow;
				ring.material[2].linewidth = current.width * 9;

				const pointCount = Math.max(24, Math.round(SEGMENT_COUNT * (current.arcLength / TAU)));
				const positions = ring.positionBuffer.array as Float32Array;
				let previousX = 0;
				let previousY = 0;
				for (let index = 0; index <= pointCount; index += 1) {
					const progress = index / pointCount;
					const angle = current.arcStart + current.arcLength * progress + current.rotation;
					const primaryWave = Math.sin(angle * ring.lobes + now * ring.speed + ring.phase);
					const secondaryWave = Math.sin(
						angle * (ring.lobes + 2) - now * ring.speed * 0.63 + ring.phase * 1.7
					);
					const voiceRipple =
						Math.sin(angle * 7 - now * 8.5 + ring.phase) *
						(activeState === 'speaking' ? smoothedLevel : 0) *
						0.016;
					const listeningRipple =
						Math.sin(angle * 4 + now * 3.2 + ring.phase) *
						(activeState === 'listening' ? 0.25 + smoothedLevel * 0.75 : 0) *
						0.01;
					const breathing = Math.sin(now * 1.25 + ring.phase) * target.breath;
					const radius =
						current.radius +
						breathing +
						current.wobble * (primaryWave * 0.68 + secondaryWave * 0.32) +
						voiceRipple +
						listeningRipple;

					const x = Math.cos(angle) * radius * current.scaleX + current.offsetX;
					const y = Math.sin(angle) * radius * current.scaleY + current.offsetY;

					if (index > 0) {
						const offset = (index - 1) * 6;
						positions[offset] = previousX;
						positions[offset + 1] = previousY;
						positions[offset + 2] = 0;
						positions[offset + 3] = x;
						positions[offset + 4] = y;
						positions[offset + 5] = 0;
					}

					previousX = x;
					previousY = y;
				}

				ring.geometry.instanceCount = pointCount;
				ring.positionBuffer.needsUpdate = true;
			});

			orb.rotation.z = Math.sin(now * 0.19) * 0.003;
			renderer.render(scene, camera);
		});

		return () => {
			renderer.setAnimationLoop(null);
			resizeObserver.disconnect();
			rings.forEach((ring) => {
				ring.geometry.dispose();
				ring.material.forEach((material) => material.dispose());
			});
			renderer.dispose();
			if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
		};
	}, []);

	return (
		<div
			ref={mountRef}
			role="img"
			aria-label={`Persona is ${state}`}
			className={cn('relative inline-flex shrink-0 overflow-hidden', className)}
			style={{ height: size, width: size, ...style }}
			{...props}
		/>
	);
}
