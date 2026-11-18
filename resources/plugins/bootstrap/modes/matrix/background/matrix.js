// Matrix rain for Plan mode: glyphs are drawn once into a texture, a WebGL2 shader rains them in two layers.
const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789';
const SIZE = 16;
const ATLAS = 8;
const CELL = 64;
const SPEED = { idle: 0.5, thinking: 1, reasoning: 1, awaiting_input: 0.3, answering: 1.6, using_tools: 2.4 };
const RADIUS = 140;
const RIPPLE_SPEED = 700;
const RIPPLE_LIFE = 1.4;
const PULSES = 4;

const canvas = document.querySelector('canvas');
const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false });
const state = { status: 'idle', reduced: false, visible: true, dark: true, speed: 0.5, time: 0, ratio: 1 };
const pointer = { x: 0, y: 0, tx: 0, ty: 0, present: false, reveal: 0 };
const pulses = new Float32Array(PULSES * 3).fill(-100);
let pulse = 0;
const clock = () => performance.now() / 1000;

const vertex = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

const fragment = `#version 300 es
precision highp float;
uniform sampler2D atlas;
uniform vec2 resolution;
uniform float time;
uniform float size;
uniform vec3 rain;
uniform vec3 head;
uniform float opacity;
uniform vec2 pointer;
uniform float reveal;
uniform float radius;
uniform float now;
uniform vec3 pulses[${PULSES}];
out vec4 color;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float glyph(vec2 cell, vec2 local, float t) {
	float index = floor(hash(cell + floor(t * (0.5 + hash(cell) * 2.0)) * 0.37) * ${GLYPHS.length}.0);
	vec2 slot = vec2(mod(index, ${ATLAS}.0), floor(index / ${ATLAS}.0));
	return texture(atlas, (slot + local) / ${ATLAS}.0).r;
}

vec4 layer(vec2 frag, float scale, float t, float seed) {
	float s = size * scale;
	vec2 cell = floor(frag / s);
	vec2 local = fract(frag / s);
	float column = cell.x + seed * 101.0;
	float g = glyph(cell, local, t);
	float residue = g * 0.07;
	if (hash(vec2(column, seed)) > 0.9) return vec4(rain * residue, residue);
	float rows = resolution.y / s;
	float fade = 0.0;
	float d = -1.0;
	for (int drop = 0; drop < 2; drop++) {
		float k = float(drop) * 17.0;
		float trail = 14.0 + hash(vec2(column, 3.0 + k)) * 18.0;
		float speed = (4.0 + hash(vec2(column, 7.0 + k)) * 8.0) / scale;
		float span = rows * 0.5 + trail;
		float distance = mod(t * speed + hash(vec2(column, 11.0 + k)) * 100.0, span + rows * 0.5) - cell.y;
		if (distance >= 0.0 && distance <= trail) {
			float f = pow(1.0 - distance / trail, 1.4);
			if (f > fade) {
				fade = f;
				d = distance;
			}
		}
	}
	float centre = 1.0 - length(local - 0.5) * 1.6;
	float glow = max(centre, 0.0) * 0.18 * fade;
	vec3 tint = d >= 0.0 && d < 1.0 ? head : rain;
	float a = max(g * fade + glow, residue);
	return vec4(tint * a, a);
}

void main() {
	vec2 frag = vec2(gl_FragCoord.x, resolution.y - gl_FragCoord.y);
	vec4 far = layer(frag, 0.45, time * 0.6, 3.0) * 0.3;
	vec4 back = layer(frag, 0.65, time * 0.8, 2.0) * 0.55;
	vec4 front = layer(frag, 1.0, time, 1.0);
	vec4 c = back + far * (1.0 - back.a);
	c = front + c * (1.0 - front.a);
	float x = abs(frag.x / resolution.x - 0.5) * 2.0;
	float clearing = mix(0.5, 1.0, smoothstep(0.15, 0.85, x));
	c *= clearing;
	vec2 cell = floor(frag / size);
	float distance = length((cell + 0.5) * size - pointer);
	float hover = reveal * pow(1.0 - smoothstep(0.0, radius, distance), 2.0);
	float ring = 0.0;
	for (int i = 0; i < ${PULSES}; i++) {
		float age = now - pulses[i].z;
		if (age < 0.0 || age > ${RIPPLE_LIFE}) continue;
		float d = length((cell + 0.5) * size - pulses[i].xy) - age * ${RIPPLE_SPEED}.0 * size / ${SIZE}.0;
		ring = max(ring, exp(-pow(d / (size * 1.5), 2.0)) * (1.0 - age / ${RIPPLE_LIFE}));
	}
	float lit = glyph(cell, fract(frag / size), time) * clamp(hover * 0.85 + ring, 0.0, 1.0);
	c = vec4(mix(rain, head, clamp(hover * hover + ring, 0.0, 1.0)) * lit, lit) + c * (1.0 - lit);
	color = c * opacity;
}`;

function compile(type, source) {
	const shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
	return shader;
}

function atlasTexture() {
	const atlas = document.createElement('canvas');
	atlas.width = atlas.height = ATLAS * CELL;
	const context = atlas.getContext('2d');
	context.fillStyle = '#fff';
	context.font = `${CELL * 0.8}px ui-monospace, "Hiragino Sans", monospace`;
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	[...GLYPHS].forEach((char, index) => {
		const x = (index % ATLAS) * CELL + CELL / 2;
		const y = Math.floor(index / ATLAS) * CELL + CELL / 2;
		context.save();
		context.translate(x, y);
		context.scale(-1, 1);
		context.fillText(char, 0, 0);
		context.restore();
	});
	const texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
	gl.generateMipmap(gl.TEXTURE_2D);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
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
atlasTexture();
const uniform = (name) => gl.getUniformLocation(program, name);

function setColors() {
	gl.uniform3fv(uniform('rain'), state.dark ? rgb('#2fe38a') : rgb('#0f8a4f'));
	gl.uniform3fv(uniform('head'), state.dark ? rgb('#e6fff0') : rgb('#04361e'));
	gl.uniform1f(uniform('opacity'), state.dark ? 0.45 : 0.5);
}
setColors();

function resize() {
	const ratio = Math.min(devicePixelRatio, 2);
	state.ratio = ratio;
	gl.uniform1f(uniform('radius'), RADIUS * ratio);
	canvas.width = Math.round(innerWidth * ratio);
	canvas.height = Math.round(innerHeight * ratio);
	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.uniform2f(uniform('resolution'), canvas.width, canvas.height);
	gl.uniform1f(uniform('size'), SIZE * ratio);
	draw();
}

function draw() {
	gl.uniform1f(uniform('time'), state.time);
	gl.uniform2f(uniform('pointer'), pointer.x, pointer.y);
	gl.uniform1f(uniform('reveal'), pointer.reveal);
	gl.uniform1f(uniform('now'), clock());
	gl.uniform3fv(uniform('pulses'), pulses);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.drawArrays(gl.TRIANGLES, 0, 3);
}

let frame = 0;
let last = performance.now();
function loop(now) {
	const target = SPEED[state.status] ?? 0.5;
	state.speed += (target - state.speed) * 0.04;
	state.time += Math.min((now - last) / 1000, 0.1) * state.speed * 0.4;
	last = now;
	pointer.x += (pointer.tx - pointer.x) * 0.25;
	pointer.y += (pointer.ty - pointer.y) * 0.25;
	pointer.reveal += ((pointer.present ? 1 : 0) - pointer.reveal) * 0.08;
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
