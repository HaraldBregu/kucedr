// Launch: a rocket climbing through clouds, dithered with an 8×8 Bayer matrix, with an intro reveal.
const PIXEL = 1;
const INTRO_SECONDS = 1.8;
const SPEED = { idle: 0.5, thinking: 1, reasoning: 1, awaiting_input: 0.3, answering: 1.6, using_tools: 2.2 };

const VERTEX = `#version 300 es
in vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }`;

const SCENE = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uCell;
uniform float uTime;
uniform float uDark;
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

vec4 scene(vec2 uv) {
	float y = uv.y + 0.5;
	vec3 color = mix(vec3(0.45, 0.32, 0.2), vec3(0.2, 0.42, 0.78), smoothstep(0.0, 0.85, y));
	float f = mix(0.1, 0.4, smoothstep(0.0, 0.9, y));

	vec2 m = (uv - vec2(-uResolution.x / uResolution.y * 0.3, 0.34)) / 0.032;
	float d = length(m);
	float halo = exp(-max(d - 1.0, 0.0) * 0.6);
	color += vec3(0.2, 0.26, 0.38) * halo * 0.25;
	f += halo * 0.06;
	float moon = smoothstep(1.0, 0.8, d);
	vec3 normal = vec3(m, sqrt(max(1.0 - d * d, 0.0)));
	float lit = clamp(dot(normal, normalize(vec3(0.5, 0.2, 0.85))), 0.0, 1.0);
	float maria = smoothstep(0.35, 0.75, fbm(m * 0.9 + 4.0));
	float surface = (0.75 + 0.25 * lit) * (1.0 - 0.2 * maria);
	vec3 haze = mix(vec3(0.9, 0.9, 0.86) * surface, vec3(0.55, 0.65, 0.82), 0.35);
	color = mix(color, haze, moon * 0.85);
	f = mix(f, 0.3 + 0.4 * surface, moon * 0.85);

	vec2 c =vec2(uv.x * 1.3, uv.y * 2.0 + uTime * 0.2);
	float cloud = smoothstep(0.6, 1.0, fbm(c + fbm(c - uTime * 0.03))) * smoothstep(0.15, 0.55, y);
	color = mix(color, vec3(0.93, 0.91, 0.87), cloud);
	f = mix(f, 0.85, cloud);

	vec2 r = uv - vec2(uResolution.x / uResolution.y * 0.25, -0.02);
	float below = max(-r.y, 0.0);
	float width = 0.015 + below * 0.4;
	float sway = (fbm(vec2(r.y * 2.0 + uTime * 0.6, 1.7)) - 0.5) * width * 0.6;
	float trail = smoothstep(width, width * 0.3, abs(r.x + sway)) * smoothstep(-0.03, -0.1, r.y);
	float smoke = trail * smoothstep(0.2, 0.6, fbm(vec2(r.x * 6.0, r.y * 3.0 + uTime * 0.8)));
	color = mix(color, vec3(0.86, 0.8, 0.72), smoke);
	f = mix(f, 0.75, smoke);

	float flicker = 0.8 + 0.2 * abs(cnoise(vec2(uTime * 25.0, 3.1)));
	float e = max(-0.012 - r.y, 0.0);
	float plume = exp(-pow(r.x / (0.007 + e * 0.1), 2.0)) * smoothstep(-0.14 * flicker, -0.012, r.y) * step(r.y, -0.012);
	float core = exp(-pow(r.x / (0.004 + e * 0.03), 2.0)) * smoothstep(-0.05 * flicker, -0.012, r.y) * step(r.y, -0.012);
	core *= 0.75 + 0.25 * cos(e * 260.0 - uTime * 4.0);
	color = mix(color, vec3(1.0, 0.55, 0.2), clamp(plume * 1.3, 0.0, 1.0));
	color = mix(color, vec3(1.0, 0.95, 0.85), clamp(core * 1.5, 0.0, 1.0));
	f = mix(f, 1.0, clamp(max(plume * 1.3, core), 0.0, 1.0));

	float w = 0.009;
	float t = clamp((r.y - 0.15) / 0.05, 0.0, 1.0);
	float radius = w * pow(1.0 - t, 0.6);
	float body = step(abs(r.x), radius) * step(0.0, r.y) * step(r.y, 0.2);
	float n = clamp(r.x / max(radius, 0.0001), -1.0, 1.0);
	float shade = 0.35 + 0.65 * clamp(sqrt(1.0 - n * n) * 0.8 - n * 0.35, 0.0, 1.0);
	float band = max(step(0.105, r.y) * step(r.y, 0.112), step(0.04, r.y) * step(r.y, 0.045));
	vec3 hull = mix(vec3(0.95, 0.95, 0.93), vec3(0.15), band) * shade;
	color = mix(color, hull, body);
	f = mix(f, mix(0.95, 0.3, band) * shade, body);

	float fin = step(w, abs(r.x)) * step(abs(r.x), w + 0.009 * clamp((0.035 - r.y) / 0.04, 0.0, 1.0)) * step(-0.006, r.y) * step(r.y, 0.035);
	color = mix(color, vec3(0.6, 0.6, 0.62), fin);
	f = mix(f, 0.65, fin);

	float bell = step(abs(r.x), 0.004 + max(-r.y, 0.0) * 0.45) * step(-0.012, r.y) * step(r.y, 0.0);
	color = mix(color, vec3(0.55, 0.5, 0.47) * (0.6 + 0.4 * (1.0 - abs(r.x) / 0.01)), bell);
	f = mix(f, 0.6, bell);
	return vec4(color, f);
}

void main() {
	vec2 uv = (gl_FragCoord.xy - 0.5) * uCell / uResolution - 0.5;
	uv.x *= uResolution.x / uResolution.y;

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

	vec4 s = scene(uv + warp);
	float f = mix(1.0 - s.a, s.a, uDark) + ring * 0.55;
	float show = clamp((uIntro * uReach - length(uv)) / 0.45, 0.0, 1.0);
	float v = clamp(f, 0.0, 1.0) * show * show * (3.0 - 2.0 * show);
	outColor = vec4(mix(s.rgb * 0.55, s.rgb, uDark), v);
}`;

const DITHER = `#version 300 es
precision highp float;
uniform sampler2D uField;
uniform ivec2 uFieldSize;
uniform float uCellDevice;
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
	ivec2 c = ivec2(mod(cell, 8.0));
	float v = field.a + (bayer8[c.y * 8 + c.x] / 64.0 - 0.25) / 3.0;
	v = clamp(v - mix(0.2, 0.0, smoothstep(0.45, 0.8, v)), 0.0, 1.0);
	float a = floor(v * 3.0 + 0.5) / 3.0 * uOpacity;
	outColor = vec4(field.rgb * a, a);
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

const scene = link(SCENE);
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
const state = { status: 'idle', reduced: false, visible: true, dark: true, speed: 0.5, time: 0, reveal: 0 };
const ripples = [];
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
	const live = ripples.slice(-MAX_RIPPLES).reverse();
	live.forEach((ripple, index) => rippleData.set([ripple.x, ripple.y, ripple.age, 1], index * 4));
	const eased = state.reveal * state.reveal * (3 - 2 * state.reveal);

	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	gl.viewport(0, 0, view.cols, view.rows);
	gl.useProgram(scene.program);
	const s = scene.uniforms;
	gl.uniform2f(s.uResolution, innerWidth, innerHeight);
	gl.uniform1f(s.uCell, view.cell / view.ratio);
	gl.uniform1f(s.uTime, state.time);
	gl.uniform1f(s.uDark, state.dark ? 1 : 0);
	gl.uniform4fv(s.uRipples, rippleData);
	gl.uniform1i(s.uRippleCount, live.length);
	gl.uniform1f(s.uIntro, eased);
	gl.uniform1f(s.uReach, 0.5 * Math.hypot(innerWidth / innerHeight, 1) + 0.45);
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
	gl.uniform1f(d.uOpacity, state.dark ? 0.5 : 0.4);
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
		if (state.reduced || !data.press || typeof data.x !== 'number' || typeof data.y !== 'number') return;
		const [x, y] = toUv(data.x, data.y);
		ripples.push({ x, y, age: 0 });
		if (ripples.length > MAX_RIPPLES) ripples.shift();
		return;
	}
	if (data?.type === 'agent') state.status = data.status;
	if (data?.type === 'motion') {
		state.reduced = data.reduced;
		if (state.reduced) ripples.length = 0;
	}
	if (data?.type === 'visible') state.visible = data.value;
	if (data?.type === 'theme') state.dark = data.dark;
	schedule();
});
addEventListener('resize', resize);
resize();
schedule();
