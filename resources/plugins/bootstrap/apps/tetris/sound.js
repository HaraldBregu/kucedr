const audio = new AudioContext();
const master = audio.createGain();
master.gain.value = 0.15;
master.connect(audio.destination);

const BEAT = 0.3;
// ponytail: Korobeiniki (public-domain folk tune) as [midi note, beats], 0 = rest
const MELODY = [
	[76, 1], [71, 0.5], [72, 0.5], [74, 1], [72, 0.5], [71, 0.5],
	[69, 1], [69, 0.5], [72, 0.5], [76, 1], [74, 0.5], [72, 0.5],
	[71, 1.5], [72, 0.5], [74, 1], [76, 1],
	[72, 1], [69, 1], [69, 1], [0, 1],
	[0, 0.5], [74, 1], [77, 0.5], [81, 1], [79, 0.5], [77, 0.5],
	[76, 1.5], [72, 0.5], [76, 1], [74, 0.5], [72, 0.5],
	[71, 1], [71, 0.5], [72, 0.5], [74, 1], [76, 1],
	[72, 1], [69, 1], [69, 1], [0, 1],
];

function tone(freq, dur, { type = 'square', at = 0, to = freq, vol = 1, out = master } = {}) {
	const t = audio.currentTime + at;
	const osc = audio.createOscillator();
	const gain = audio.createGain();
	osc.type = type;
	osc.frequency.setValueAtTime(freq, t);
	osc.frequency.exponentialRampToValueAtTime(to, t + dur);
	gain.gain.setValueAtTime(vol, t);
	gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
	osc.connect(gain).connect(out);
	osc.start(t);
	osc.stop(t + dur);
}

const sfx = {
	move: () => tone(220, 0.03),
	rotate: () => tone(440, 0.06, { to: 660 }),
	lock: () => tone(140, 0.08, { type: 'triangle', to: 70 }),
	drop: () => tone(220, 0.15, { type: 'triangle', to: 40, vol: 2 }),
	clear: (n) => [523, 659, 784, 1047, 1319, 1568].slice(0, n + 2).forEach((f, i) => tone(f, 0.12, { at: i * 0.06 })),
	level: () => [392, 523, 659, 784].forEach((f, i) => tone(f, 0.15, { type: 'triangle', at: i * 0.08, vol: 2 })),
	over: () => tone(440, 1.2, { type: 'sawtooth', to: 55 }),
};

const music = {
	gain: null,
	timer: 0,
	start() {
		this.stop();
		this.gain = audio.createGain();
		this.gain.gain.value = 0.5;
		this.gain.connect(master);
		this.loop();
	},
	loop() {
		let at = 0;
		for (const [note, beats] of MELODY) {
			if (note) tone(440 * 2 ** ((note - 69) / 12), beats * BEAT * 0.9, { at, out: this.gain });
			at += beats * BEAT;
		}
		this.timer = setTimeout(() => this.loop(), at * 1000);
	},
	stop() {
		clearTimeout(this.timer);
		this.gain?.disconnect();
		this.gain = null;
	},
};

function toggleMute() {
	master.gain.value = master.gain.value ? 0 : 0.15;
}
