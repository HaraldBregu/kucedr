// Launch: a rocket climbing through clouds, tracked by the camera and printed as an ordered-dither halftone.
const SIZE = 5;
const SPEED = { idle: 0.4, thinking: 1, reasoning: 1, awaiting_input: 0.3, answering: 1.6, using_tools: 2.2 };

const canvas = document.querySelector('canvas');
const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false });
const state = { status: 'idle', reduced: false, visible: true, dark: true, speed: 0.4, time: 0 };

const vertex = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float size;
uniform float dark;
uniform float opacity;
out vec4 color;

const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float fbm(vec2 p) {
	float v = 0.0;
	float a = 0.5;
	for (int i = 0; i < 4; i++) {
		v += a * noise(p);
		p *= 2.0;
		a *= 0.5;
	}
	return v;
}

vec3 scene(vec2 uv) {
	float aspect = resolution.x / resolution.y;
	vec3 c = mix(vec3(0.1, 0.07, 0.05), vec3(0.12, 0.3, 0.6), smoothstep(0.0, 0.9, uv.y));
	float clouds = fbm(vec2(uv.x * 2.2, uv.y * 3.0 + time * 0.5));
	c = mix(c, vec3(0.92, 0.9, 0.86), smoothstep(0.48, 0.72, clouds) * smoothstep(0.25, 0.6, uv.y));
	float haze = fbm(vec2(uv.x * 1.3 + 7.0, uv.y * 1.6 + time * 0.2));
	c = mix(c, vec3(0.5, 0.38, 0.26), smoothstep(0.45, 0.0, uv.y) * smoothstep(0.35, 0.7, haze));

	vec2 r = uv - vec2(aspect * 0.72, 0.5);
	float below = max(-r.y, 0.0);
	float width = 0.02 + below * 0.35;
	float drift = (fbm(vec2(r.y * 3.0 + time * 1.5, 2.0)) - 0.5) * width;
	float trail = smoothstep(width, width * 0.4, abs(r.x + drift)) * smoothstep(-0.05, -0.12, r.y);
	float billow = fbm(vec2(r.x * 7.0, r.y * 4.0 + time * 2.0));
	c = mix(c, vec3(0.88, 0.82, 0.74), trail * smoothstep(0.2, 0.55, billow));

	float flicker = 0.8 + 0.2 * noise(vec2(time * 30.0, 1.0));
	float flame = exp(-pow(r.x / (0.008 + below * 0.15), 2.0)) * smoothstep(-0.14 * flicker, 0.0, r.y) * step(r.y, 0.0);
	c = mix(c, vec3(1.0, 0.9, 0.7), clamp(flame * 1.5, 0.0, 1.0));

	float taper = clamp((0.22 - r.y) / 0.05, 0.0, 1.0);
	float body = step(abs(r.x), 0.013 * taper) * step(0.0, r.y) * step(r.y, 0.22);
	return mix(c, vec3(0.95), body);
}

void main() {
	vec2 frag = vec2(gl_FragCoord.x, gl_FragCoord.y);
	vec2 cell = floor(frag / size);
	vec3 c = scene((cell + 0.5) * size / resolution.y);
	float light = dot(c, vec3(0.299, 0.587, 0.114));
	float level = smoothstep(0.05, 0.85, mix(1.0 - light, light, dark)) * mix(0.65, 1.0, dark);
	ivec2 m = ivec2(mod(cell, 4.0));
	float on = step(BAYER[m.x + m.y * 4] / 16.0 + 0.03, level);
	float disc = smoothstep(0.44, 0.32, length(fract(frag / size) - 0.5));
	float x = abs(frag.x / resolution.x - 0.5) * 2.0;
	float a = on * disc * opacity * mix(0.45, 1.0, smoothstep(0.1, 0.8, x));
	color = vec4(mix(c * 0.55, c, dark) * a, a);
}`;

function compile(type, source) {
	const shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
	return shader;
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

function setColors() {
	gl.uniform1f(uniform('dark'), state.dark ? 1 : 0);
	gl.uniform1f(uniform('opacity'), state.dark ? 0.5 : 0.35);
}
setColors();

function resize() {
	const ratio = Math.min(devicePixelRatio, 2);
	canvas.width = Math.round(innerWidth * ratio);
	canvas.height = Math.round(innerHeight * ratio);
	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.uniform2f(uniform('resolution'), canvas.width, canvas.height);
	gl.uniform1f(uniform('size'), SIZE * ratio);
	draw();
}

function draw() {
	gl.uniform1f(uniform('time'), state.time);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.drawArrays(gl.TRIANGLES, 0, 3);
}

let frame = 0;
let last = performance.now();
function loop(now) {
	const target = SPEED[state.status] ?? 0.4;
	state.speed += (target - state.speed) * 0.04;
	state.time += Math.min((now - last) / 1000, 0.1) * state.speed * 0.4;
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
		setColors();
	}
	schedule();
});
addEventListener('resize', resize);
resize();
schedule();
