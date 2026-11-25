// Launch: an fbm wave field dithered with an 8×8 Bayer matrix, with a cursor erase trail, click ripples, and an intro reveal.
const PIXEL = 2;
const RADIUS = 0.35;
const TRAIL = 0.5;
const MAX_TRAIL = 16;
const MAX_RIPPLES = 4;
const INTRO_SECONDS = 1.8;
const RIPPLE_SECONDS = 1.6;
const SPEED = { idle: 0.5, thinking: 1, reasoning: 1, awaiting_input: 0.3, answering: 1.6, using_tools: 2.2 };

const VERTEX = `#version 300 es
in vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }`;

const WAVE = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uCell;
uniform float uTime;
uniform vec3 uTrail[${MAX_TRAIL}];
uniform int uTrailCount;
uniform vec4 uRipples[${MAX_RIPPLES}];
uniform int uRippleCount;
uniform float uIntro;
uniform float uReach;
out vec4 outColor;

vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec2 fade(vec2 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }

float cnoise(vec2 P) {
	vec4 Pi = mod289(floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0));
	vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
	vec4 i = permute(permute(Pi.xzxz) + Pi.yyww);
	vec4 gx = fract(i * (1.0 / 41.0)) * 2.0 - 1.0;
	vec4 gy = abs(gx) - 0.5;
	gx -= floor(gx + 0.5);
	vec2 g00 = vec2(gx.x, gy.x);
	vec2 g10 = vec2(gx.y, gy.y);
	vec2 g01 = vec2(gx.z, gy.z);
	vec2 g11 = vec2(gx.w, gy.w);
	vec4 norm = taylorInvSqrt(vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11)));
	g00 *= norm.x;
	g01 *= norm.y;
	g10 *= norm.z;
	g11 *= norm.w;
	float n00 = dot(g00, vec2(Pf.x, Pf.y));
	float n10 = dot(g10, vec2(Pf.z, Pf.y));
	float n01 = dot(g01, vec2(Pf.x, Pf.w));
	float n11 = dot(g11, vec2(Pf.z, Pf.w));
	vec2 f = fade(Pf.xy);
	vec2 nx = mix(vec2(n00, n01), vec2(n10, n11), f.x);
	return 2.3 * mix(nx.x, nx.y, f.y);
}

float fbm(vec2 p) {
	float value = 0.0;
	float amp = 1.0;
	for (int i = 0; i < 4; i++) {
		value += amp * abs(cnoise(p));
		p *= 3.0;
		amp *= 0.3;
	}
	return value;
}

void main() {
	vec2 uv = (gl_FragCoord.xy - 0.5) * uCell / uResolution - 0.5;
	uv.x *= uResolution.x / uResolution.y;

	float touch = 0.0;
	for (int i = 0; i < ${MAX_TRAIL}; i++) {
		if (i >= uTrailCount) break;
		vec3 point = uTrail[i];
		float reach = ${RADIUS.toFixed(2)} * mix(0.55, 1.0, point.z);
		touch = max(touch, point.z * (1.0 - smoothstep(0.0, reach, length(uv - point.xy))));
	}

	vec2 warp = vec2(0.0);
	float ring = 0.0;
	for (int i = 0; i < ${MAX_RIPPLES}; i++) {
		if (i >= uRippleCount) break;
		vec4 ripple = uRipples[i];
		vec2 delta = uv - ripple.xy;
		float dist = length(delta);
		float life = clamp(ripple.z / ${RIPPLE_SECONDS.toFixed(2)}, 0.0, 1.0);
		float wave = exp(-pow((dist - ripple.z * 0.9) / 0.07, 2.0)) * (1.0 - life) * (1.0 - life);
		warp += (dist > 0.0001 ? delta / dist : vec2(0.0)) * wave * 0.035;
		ring += wave;
	}

	vec2 p = uv + warp;
	float f = fbm(p + fbm(p - uTime * 0.05)) - 0.5 * touch + ring * 0.55;
	float show = clamp((uIntro * uReach - length(uv)) / 0.45, 0.0, 1.0);
	float v = clamp(f, 0.0, 1.0) * show * show * (3.0 - 2.0 * show);
	outColor = vec4(floor(v * 255.0) / 255.0, fract(v * 255.0), 0.0, 1.0);
}`;

const DITHER = `#version 300 es
precision highp float;
uniform sampler2D uField;
uniform ivec2 uFieldSize;
uniform float uCellDevice;
uniform vec3 uColor;
uniform float uOpacity;
out vec4 outColor;

const float bayer8[64] = float[64](
	0.0, 48.0, 12.0, 60.0, 3.0, 51.0, 15.0, 63.0,
	32.0, 16.0, 44.0, 28.0, 35.0, 19.0, 47.0, 31.0,
	8.0, 56.0, 4.0, 52.0, 11.0, 59.0, 7.0, 55.0,
	40.0, 24.0, 36.0, 20.0, 43.0, 27.0, 39.0, 23.0,
	2.0, 50.0, 14.0, 62.0, 1.0, 49.0, 13.0, 61.0,
	34.0, 18.0, 46.0, 30.0, 33.0, 17.0, 45.0, 29.0,
	10.0, 58.0, 6.0, 54.0, 9.0, 57.0, 5.0, 53.0,
	42.0, 26.0, 38.0, 22.0, 41.0, 25.0, 37.0, 21.0
);

void main() {
	vec2 cell = floor(gl_FragCoord.xy / uCellDevice);
	vec4 field = texelFetch(uField, clamp(ivec2(cell), ivec2(0), uFieldSize - 1), 0);
	float f = field.r + field.g / 255.0;
	ivec2 c = ivec2(mod(cell, 8.0));
	float v = f + (bayer8[c.y * 8 + c.x] / 64.0 - 0.25) / 3.0;
	v = clamp(v - mix(0.2, 0.0, smoothstep(0.45, 0.8, v)), 0.0, 1.0);
	float a = floor(v * 3.0 + 0.5) / 3.0 * uOpacity;
	outColor = vec4(uColor * a, a);
}`;

const canvas = document.querySelector('canvas');
const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false, depth: false, stencil: false });

function link(fragment) {
	const program = gl.createProgram();
	for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, fragment]]) {
		const shader = gl.createShader(type);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
		gl.attachShader(program, shader);
	}
	gl.bindAttribLocation(program, 0, 'aPosition');
	gl.linkProgram(program);
	const uniforms = {};
	for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i++) {
		const { name } = gl.getActiveUniform(program, i);
		uniforms[name.replace('[0]', '')] = gl.getUniformLocation(program, name);
	}
	return { program, uniforms };
}

function rgb(css) {
	const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
	probe.fillStyle = '#888';
	probe.fillStyle = css;
	probe.fillRect(0, 0, 1, 1);
	const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
	return [r / 255, g / 255, b / 255];
}

const wave = link(WAVE);
const dither = link(DITHER);
gl.bindVertexArray(gl.createVertexArray());
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
const field = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, field);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
const framebuffer = gl.createFramebuffer();

const view = { ratio: 1, cell: 1, cols: 1, rows: 1 };
const state = { status: 'idle', reduced: false, visible: true, speed: 0.5, time: 0, reveal: 0, color: [0.5, 0.5, 0.5], opacity: 0.45 };
const pointer = { x: 0, y: 0, inside: false, set: false, hx: 0, hy: 0, presence: 0 };
const trail = [];
const ripples = [];
const trailData = new Float32Array(MAX_TRAIL * 3);
const rippleData = new Float32Array(MAX_RIPPLES * 4);

const toUv = (x, y) => [(x / innerWidth - 0.5) * (innerWidth / innerHeight), -(y / innerHeight - 0.5)];

function resize() {
	view.ratio = Math.min(devicePixelRatio, 2);
	canvas.width = Math.max(1, Math.round(innerWidth * view.ratio));
	canvas.height = Math.max(1, Math.round(innerHeight * view.ratio));
	view.cell = Math.max(1, Math.round(PIXEL * view.ratio));
	view.cols = Math.ceil(canvas.width / view.cell);
	view.rows = Math.ceil(canvas.height / view.cell);
	gl.bindTexture(gl.TEXTURE_2D, field);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, view.cols, view.rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, field, 0);
	render();
}

function render() {
	const points = trail.filter((point) => point.weight > 0.01).slice(0, MAX_TRAIL);
	points.forEach((point, index) => trailData.set([point.x, point.y, point.weight], index * 3));
	const live = ripples.slice(-MAX_RIPPLES).reverse();
	live.forEach((ripple, index) => rippleData.set([ripple.x, ripple.y, ripple.age, 1], index * 4));
	const eased = state.reveal * state.reveal * (3 - 2 * state.reveal);

	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	gl.viewport(0, 0, view.cols, view.rows);
	gl.useProgram(wave.program);
	const w = wave.uniforms;
	gl.uniform2f(w.uResolution, innerWidth, innerHeight);
	gl.uniform1f(w.uCell, view.cell / view.ratio);
	gl.uniform1f(w.uTime, state.time);
	gl.uniform3fv(w.uTrail, trailData);
	gl.uniform1i(w.uTrailCount, points.length);
	gl.uniform4fv(w.uRipples, rippleData);
	gl.uniform1i(w.uRippleCount, live.length);
	gl.uniform1f(w.uIntro, eased);
	gl.uniform1f(w.uReach, 0.5 * Math.hypot(innerWidth / innerHeight, 1) + 0.45);
	gl.drawArrays(gl.TRIANGLES, 0, 3);

	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.useProgram(dither.program);
	const d = dither.uniforms;
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, field);
	gl.uniform1i(d.uField, 0);
	gl.uniform2i(d.uFieldSize, view.cols, view.rows);
	gl.uniform1f(d.uCellDevice, view.cell);
	gl.uniform3fv(d.uColor, state.color);
	gl.uniform1f(d.uOpacity, state.opacity);
	gl.drawArrays(gl.TRIANGLES, 0, 3);
}

let raf = 0;
let last = 0;
function frame(now) {
	const dt = last ? Math.min(Math.max((now - last) / 1000, 0.0005), 0.05) : 1 / 60;
	last = now;
	state.speed += ((SPEED[state.status] ?? 0.5) - state.speed) * 0.04;
	state.time += dt * state.speed;
	state.reveal = Math.min(1, state.reveal + dt / INTRO_SECONDS);

	pointer.presence += ((pointer.inside ? 1 : 0) - pointer.presence) * (1 - Math.exp(-dt / (pointer.inside ? 0.12 : 0.35)));
	if (pointer.set) {
		const [tx, ty] = toUv(pointer.x, pointer.y);
		const moved = Math.hypot(tx - pointer.hx, ty - pointer.hy);
		const follow = 1 - Math.exp(-dt / 0.06);
		pointer.hx += (tx - pointer.hx) * follow;
		pointer.hy += (ty - pointer.hy) * follow;
		const decay = Math.exp(-dt / (0.08 + TRAIL * 0.7));
		for (const point of trail) point.weight *= decay;
		const head = trail[0];
		if (!head || Math.hypot(head.x - pointer.hx, head.y - pointer.hy) > 0.012 || moved > 0.012) {
			trail.unshift({ x: pointer.hx, y: pointer.hy, weight: pointer.presence });
		} else {
			Object.assign(head, { x: pointer.hx, y: pointer.hy, weight: pointer.presence });
		}
		while (trail.length > MAX_TRAIL || (trail.length > 1 && trail[trail.length - 1].weight < 0.01)) trail.pop();
	}
	for (let i = ripples.length - 1; i >= 0; i--) {
		ripples[i].age += dt;
		if (ripples[i].age >= RIPPLE_SECONDS) ripples.splice(i, 1);
	}

	render();
	raf = requestAnimationFrame(frame);
}

function schedule() {
	cancelAnimationFrame(raf);
	raf = 0;
	last = 0;
	if (state.reduced) state.reveal = 1;
	if (state.reduced || !state.visible) return render();
	raf = requestAnimationFrame(frame);
}

addEventListener('message', ({ data }) => {
	if (data?.type === 'pointer') {
		if (state.reduced) return;
		pointer.inside = typeof data.x === 'number' && typeof data.y === 'number';
		if (!pointer.inside) return;
		pointer.x = data.x;
		pointer.y = data.y;
		if (!pointer.set) {
			[pointer.hx, pointer.hy] = toUv(data.x, data.y);
			pointer.set = true;
		}
		if (data.press) {
			const [x, y] = toUv(data.x, data.y);
			ripples.push({ x, y, age: 0 });
			if (ripples.length > MAX_RIPPLES) ripples.shift();
		}
		return;
	}
	if (data?.type === 'agent') state.status = data.status;
	if (data?.type === 'motion') {
		state.reduced = data.reduced;
		if (state.reduced) {
			pointer.inside = false;
			trail.length = 0;
			ripples.length = 0;
		}
	}
	if (data?.type === 'visible') state.visible = data.value;
	if (data?.type === 'theme') {
		state.color = rgb(data.colors?.foreground || (data.dark ? '#d4d4d4' : '#404040'));
		state.opacity = data.dark ? 0.45 : 0.35;
	}
	schedule();
});
addEventListener('resize', resize);
resize();
schedule();
