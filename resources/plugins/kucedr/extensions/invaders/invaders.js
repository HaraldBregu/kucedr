const W = 480;
const H = 420;
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const keys = {};

let player, shots, bombs, aliens, alienDir, alienSpeed, score, lives, over, paused, wave;

function spawnWave() {
	aliens = [];
	for (let row = 0; row < 5; row++)
		for (let col = 0; col < 11; col++)
			aliens.push({ x: 40 + col * 34, y: 40 + row * 28, row });
	alienDir = 1;
	alienSpeed = 0.4 + wave * 0.15;
	shots = [];
	bombs = [];
}

function reset() {
	player = { x: W / 2, cooldown: 0 };
	score = 0;
	lives = 3;
	wave = 0;
	over = paused = false;
	spawnWave();
}

function hit(a, b, w, h) {
	return Math.abs(a.x - b.x) < w && Math.abs(a.y - b.y) < h;
}

function update() {
	if (over || paused) return;
	if (keys.ArrowLeft || keys.a) player.x = Math.max(16, player.x - 4);
	if (keys.ArrowRight || keys.d) player.x = Math.min(W - 16, player.x + 4);
	if (player.cooldown > 0) player.cooldown--;
	if (keys[' '] && player.cooldown === 0) {
		shots.push({ x: player.x, y: H - 40 });
		player.cooldown = 20;
	}

	const speed = alienSpeed * (1 + (55 - aliens.length) / 20);
	const edge = aliens.some((a) => (alienDir > 0 ? a.x > W - 20 : a.x < 20));
	for (const a of aliens) {
		if (edge) a.y += 14;
		else a.x += alienDir * speed;
	}
	if (edge) alienDir = -alienDir;
	if (aliens.length && Math.random() < 0.02 + wave * 0.005) {
		const a = aliens[Math.floor(Math.random() * aliens.length)];
		bombs.push({ x: a.x, y: a.y + 10 });
	}

	for (const s of shots) s.y -= 7;
	for (const b of bombs) b.y += 3.5;
	shots = shots.filter((s) => {
		const i = aliens.findIndex((a) => hit(s, a, 14, 10));
		if (i < 0) return s.y > 0;
		score += (5 - aliens[i].row) * 10;
		aliens.splice(i, 1);
		return false;
	});
	bombs = bombs.filter((b) => {
		if (!hit(b, { x: player.x, y: H - 24 }, 16, 10)) return b.y < H;
		if (--lives <= 0) over = true;
		return false;
	});
	if (aliens.some((a) => a.y > H - 50)) over = true;
	if (!aliens.length) {
		wave++;
		spawnWave();
	}
}

function draw() {
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, W, H);
	ctx.fillStyle = '#3c3';
	ctx.fillRect(player.x - 16, H - 28, 32, 10);
	ctx.fillRect(player.x - 3, H - 36, 6, 8);
	for (const a of aliens) {
		ctx.fillStyle = ['#f3f', '#f3f', '#3cf', '#3cf', '#ff3'][a.row];
		ctx.fillRect(a.x - 12, a.y - 8, 24, 16);
		ctx.fillStyle = '#000';
		ctx.fillRect(a.x - 7, a.y - 3, 4, 4);
		ctx.fillRect(a.x + 3, a.y - 3, 4, 4);
	}
	ctx.fillStyle = '#fff';
	for (const s of shots) ctx.fillRect(s.x - 1, s.y - 6, 2, 10);
	ctx.fillStyle = '#e33';
	for (const b of bombs) ctx.fillRect(b.x - 2, b.y - 4, 4, 8);
	hud.textContent = `Score: ${score} · Lives: ${lives} · Wave: ${wave + 1}`;
	if (over || paused) {
		ctx.fillStyle = '#fff';
		ctx.font = '24px system-ui';
		ctx.textAlign = 'center';
		ctx.fillText(over ? 'Game over — Enter to restart' : 'Paused', W / 2, H / 2);
	}
}

document.addEventListener('keydown', (e) => {
	const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
	if (key === 'p') paused = !paused;
	else if (key === 'Enter' && over) reset();
	else if (!['ArrowLeft', 'ArrowRight', 'a', 'd', ' '].includes(key)) return;
	keys[key] = true;
	e.preventDefault();
});
document.addEventListener('keyup', (e) => {
	keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false;
});

reset();
canvas.focus();
(function loop() {
	update();
	draw();
	requestAnimationFrame(loop);
})();
