// Ordered dither for Goal mode: a flowing noise field quantised through an 8x8 Bayer matrix in a WebGL2 shader.
const PIXEL = 3;
const ACTIVITY = { idle: 0, thinking: 0.5, reasoning: 0.5, awaiting_input: 0, answering: 0.8, using_tools: 1 };

const canvas = document.querySelector('canvas');
const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false });
const state = { status: 'idle', reduced: false, visible: true, dark: true, activity: 0, time: 0 };

const vertex = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float pixel;
uniform float activity;
uniform vec3 ink;
uniform float opacity;
out vec4 color;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

float fbm(vec2 p) {
	float v = 0.0;
	float a = 0.5;
	for (int i = 0; i < 5; i++) {
		v += a * noise(p);
		p = p * 2.03 + vec2(1.7, 9.2);
		a *= 0.5;
	}
	return v;
}

float bayer(vec2 p) {
	ivec2 q = ivec2(mod(p, 8.0));
	int x = q.x ^ q.y;
	int v = ((x & 1) << 5) | ((q.y & 1) << 4) | ((x & 2) << 2) | ((q.y & 2) << 1) | ((x & 4) >> 1) | ((q.y & 4) >> 2);
	return (float(v) + 0.5) / 64.0;
}

void main() {
	vec2 cell = floor(gl_FragCoord.xy / pixel);
	vec2 uv = cell * pixel / resolution.y;
	vec2 flow = vec2(fbm(uv * 1.5 + time * 0.05), fbm(uv * 1.5 - time * 0.04 + 4.0));
	float field = fbm(uv * 2.2 + flow * 1.8 + vec2(time * 0.03, -time * 0.02));
	float sweep = 0.5 + 0.5 * sin(uv.x * 3.0 - time * 0.6);
	float level = field * (0.75 + 0.25 * activity) + sweep * 0.25 * activity - 0.12;
	float x = abs(gl_FragCoord.x / resolution.x - 0.5) * 2.0;
	level *= mix(0.45, 1.0, smoothstep(0.15, 0.85, x));
	float on = step(bayer(cell), level);
	color = vec4(ink, 1.0) * on * opacity;
}`;

function compile(type, source) {
	const shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
	return shader;
}

function rgb(css) {
	const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
	probe.fillStyle = css;
	probe.fillRect(0, 0, 1, 1);
	const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
	return [r / 255, g / 255, b / 255];
}

const program = gl.createProgram();
gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
gl.linkProgram(program);
gl.useProgram(program);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
const uniform = (name) => gl.getUniformLocation(program, name);

function setColors(colors = {}) {
	gl.uniform3fv(uniform('ink'), rgb(colors.foreground ?? (state.dark ? '#fafafa' : '#141414')));
	gl.uniform1f(uniform('opacity'), state.dark ? 0.16 : 0.12);
}
setColors();

function resize() {
	const ratio = Math.min(devicePixelRatio, 2);
	canvas.width = Math.round(innerWidth * ratio);
	canvas.height = Math.round(innerHeight * ratio);
	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.uniform2f(uniform('resolution'), canvas.width, canvas.height);
	gl.uniform1f(uniform('pixel'), PIXEL * ratio);
	draw();
}

function draw() {
	gl.uniform1f(uniform('time'), state.time);
	gl.uniform1f(uniform('activity'), state.activity);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.drawArrays(gl.TRIANGLES, 0, 3);
}

let frame = 0;
let last = performance.now();
function loop(now) {
	state.activity += ((ACTIVITY[state.status] ?? 0) - state.activity) * 0.03;
	state.time += Math.min((now - last) / 1000, 0.1) * (1 + state.activity * 2);
	last = now;
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
	if (data?.type === 'theme') {
		state.dark = data.dark;
		setColors(data.colors);
	}
	schedule();
});
addEventListener('resize', resize);
resize();
schedule();
