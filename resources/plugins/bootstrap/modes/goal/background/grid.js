// Flickering grid for Goal mode: small squares on a fixed grid, each re-rolling its opacity at random.
const SQUARE = 4;
const GAP = 6;
const MAX_OPACITY = 0.3;
const FLICKER = { idle: 0.3, thinking: 0.8, reasoning: 0.8, awaiting_input: 0.2, answering: 1.4, using_tools: 2 };

const canvas = document.querySelector('canvas');
const context = canvas.getContext('2d');
const state = { status: 'idle', reduced: false, visible: true, color: '#888', chance: 0.3 };
let grid = { cols: 0, rows: 0, ratio: 1, opacity: new Float32Array(0), mask: new Float32Array(0) };

function resize() {
	const ratio = Math.min(devicePixelRatio, 2);
	canvas.width = Math.round(innerWidth * ratio);
	canvas.height = Math.round(innerHeight * ratio);
	const cols = Math.ceil(innerWidth / (SQUARE + GAP));
	const rows = Math.ceil(innerHeight / (SQUARE + GAP));
	const opacity = new Float32Array(cols * rows).map(() => Math.random() * MAX_OPACITY);
	const mask = new Float32Array(cols * rows).map((_, index) => {
		const x = ((index % cols) / cols - 0.5) * 1.4;
		const y = Math.floor(index / cols) / rows - 0.5;
		const distance = Math.hypot(x, y);
		return 0.15 + 0.85 * Math.min(Math.max((distance - 0.12) / 0.5, 0), 1);
	});
	grid = { cols, rows, ratio, opacity, mask };
	draw();
}

function draw() {
	const { cols, rows, ratio, opacity, mask } = grid;
	const size = SQUARE * ratio;
	const step = (SQUARE + GAP) * ratio;
	context.clearRect(0, 0, canvas.width, canvas.height);
	context.fillStyle = state.color;
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			const index = row * cols + col;
			context.globalAlpha = opacity[index] * mask[index];
			context.fillRect(col * step, row * step, size, size);
		}
	}
}

let frame = 0;
let last = performance.now();
function loop(now) {
	const delta = Math.min((now - last) / 1000, 0.1);
	last = now;
	state.chance += ((FLICKER[state.status] ?? 0.3) - state.chance) * 0.05;
	const { opacity } = grid;
	for (let index = 0; index < opacity.length; index++) {
		if (Math.random() < state.chance * delta) opacity[index] = Math.random() * MAX_OPACITY;
	}
	draw();
	frame = requestAnimationFrame(loop);
}

function schedule() {
	cancelAnimationFrame(frame);
	frame = 0;
	if (state.reduced || !state.visible) return draw();
	last = performance.now();
	frame = requestAnimationFrame(loop);
}

addEventListener('message', ({ data }) => {
	if (data?.type === 'agent') state.status = data.status;
	if (data?.type === 'motion') state.reduced = data.reduced;
	if (data?.type === 'visible') state.visible = data.value;
	if (data?.type === 'theme') state.color = data.colors.foreground || state.color;
	schedule();
});
addEventListener('resize', resize);
resize();
schedule();
