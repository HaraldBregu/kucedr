const COLS = 10;
const ROWS = 20;
const SIZE = 24;
const PANEL = COLS * SIZE + 16;
const SHAPES = [
	[[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
	[[1, 1], [1, 1]],
	[[0, 1, 0], [1, 1, 1], [0, 0, 0]],
	[[0, 1, 1], [1, 1, 0], [0, 0, 0]],
	[[1, 1, 0], [0, 1, 1], [0, 0, 0]],
	[[1, 0, 0], [1, 1, 1], [0, 0, 0]],
	[[0, 0, 1], [1, 1, 1], [0, 0, 0]],
];
const POINTS = [0, 100, 300, 500, 800];
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const sprites = new Image();
sprites.src = 'sprites.svg';

let board, bag, piece, next, score, lines, level, over, paused, started, clearing, lastDrop;

function reset() {
	board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
	bag = [];
	next = take();
	score = lines = 0;
	level = 1;
	over = paused = false;
	started = true;
	clearing = null;
	lastDrop = performance.now();
	spawn();
	music.start();
}

function take() {
	if (!bag.length) bag = [0, 1, 2, 3, 4, 5, 6].sort(() => Math.random() - 0.5);
	return bag.pop();
}

function spawn() {
	const m = SHAPES[next];
	piece = { i: next, m, x: Math.floor((COLS - m.length) / 2), y: next === 0 ? -1 : 0 };
	next = take();
	if (collide(piece.m, piece.x, piece.y)) gameOver();
}

function gameOver() {
	over = true;
	music.stop();
	sfx.over();
}

function collide(m, x, y) {
	return m.some((row, r) => row.some((v, c) => {
		if (!v) return false;
		const bx = x + c;
		const by = y + r;
		return bx < 0 || bx >= COLS || by >= ROWS || (by >= 0 && board[by][bx]);
	}));
}

function rotate(m, dir) {
	return m[0].map((_, i) => (dir > 0 ? m.map((row) => row[i]).reverse() : m.map((row) => row[row.length - 1 - i])));
}

function move(dx, dy) {
	if (collide(piece.m, piece.x + dx, piece.y + dy)) return false;
	piece.x += dx;
	piece.y += dy;
	return true;
}

function turn(dir) {
	const m = rotate(piece.m, dir);
	for (const kick of [0, -1, 1, -2, 2]) {
		if (collide(m, piece.x + kick, piece.y)) continue;
		piece.m = m;
		piece.x += kick;
		sfx.rotate();
		return;
	}
}

function ghostY() {
	let y = piece.y;
	while (!collide(piece.m, piece.x, y + 1)) y++;
	return y;
}

function lock() {
	for (const [r, row] of piece.m.entries())
		for (const [c, v] of row.entries()) {
			if (!v) continue;
			if (piece.y + r < 0) return gameOver();
			board[piece.y + r][piece.x + c] = piece.i + 1;
		}
	sfx.lock();
	const full = board.flatMap((row, r) => (row.every(Boolean) ? [r] : []));
	if (!full.length) return spawn();
	clearing = { rows: full, until: performance.now() + 300 };
	piece = null;
	sfx.clear(full.length);
}

function finishClear() {
	const n = clearing.rows.length;
	board = board.filter((_, r) => !clearing.rows.includes(r));
	while (board.length < ROWS) board.unshift(Array(COLS).fill(0));
	clearing = null;
	lines += n;
	score += POINTS[n] * level;
	if (Math.floor(lines / 10) + 1 > level) {
		level = Math.floor(lines / 10) + 1;
		sfx.level();
	}
	spawn();
}

function tile(i, x, y, size = SIZE) {
	ctx.drawImage(sprites, i * 8, 0, 8, 8, x, y, size, size);
}

function drawShape(m, i, x, y, size = SIZE) {
	for (const [r, row] of m.entries())
		for (const [c, v] of row.entries()) if (v && y + r * size >= 0) tile(i, x + c * size, y + r * size, size);
}

function text(str, x, y, color = '#fff', size = 16, align = 'left') {
	ctx.fillStyle = color;
	ctx.font = `${size}px ui-monospace, Menlo, monospace`;
	ctx.textAlign = align;
	ctx.fillText(str, x, y);
}

function draw(t) {
	ctx.imageSmoothingEnabled = false;
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = '#111';
	ctx.fillRect(0, 0, COLS * SIZE, ROWS * SIZE);

	if (board) {
		const flash = clearing && Math.floor(t / 60) % 2;
		for (const [r, row] of board.entries()) {
			if (flash && clearing.rows.includes(r)) {
				ctx.fillStyle = '#fff';
				ctx.fillRect(0, r * SIZE, COLS * SIZE, SIZE);
				continue;
			}
			for (const [c, v] of row.entries()) if (v) tile(v - 1, c * SIZE, r * SIZE);
		}
		if (piece && !over) {
			ctx.globalAlpha = 0.25;
			drawShape(piece.m, piece.i, piece.x * SIZE, ghostY() * SIZE);
			ctx.globalAlpha = 1;
			drawShape(piece.m, piece.i, piece.x * SIZE, piece.y * SIZE);
		}
		text('NEXT', PANEL, 24, '#ff3');
		drawShape(SHAPES[next], next, PANEL, 40, 18);
		text('SCORE', PANEL, 140, '#ff3');
		text(score, PANEL, 162);
		text('LINES', PANEL, 200, '#ff3');
		text(lines, PANEL, 222);
		text('LEVEL', PANEL, 260, '#ff3');
		text(level, PANEL, 282);
	}

	const mid = (COLS * SIZE) / 2;
	if (!started || over || paused) {
		ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
		ctx.fillRect(0, 0, COLS * SIZE, ROWS * SIZE);
	}
	if (!started) {
		text('TETRIS', mid, 200, '#ff3', 36, 'center');
		if (Math.floor(t / 500) % 2) text('PRESS ENTER', mid, 260, '#3c3', 16, 'center');
	} else if (over) {
		text('GAME OVER', mid, 220, '#e33', 28, 'center');
		text('Enter to restart', mid, 260, '#fff', 14, 'center');
	} else if (paused) {
		text('PAUSED', mid, 240, '#3cf', 28, 'center');
	}
}

function speed() {
	return Math.max(80, 800 - (level - 1) * 70);
}

function frame(t) {
	if (started && !over && !paused) {
		if (clearing) {
			if (t >= clearing.until) finishClear();
		} else if (t - lastDrop > speed()) {
			lastDrop = t;
			if (!move(0, 1)) lock();
		}
	}
	draw(t);
	requestAnimationFrame(frame);
}

document.addEventListener('keydown', (e) => {
	audio.resume();
	const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
	if (key === 'Enter' && (!started || over)) reset();
	else if (key === 'm') toggleMute();
	else if (!started || over) return;
	else if (key === 'p') {
		paused = !paused;
		paused ? music.stop() : music.start();
	} else if (paused || !piece) return;
	else if ((key === 'ArrowLeft' || key === 'a') && move(-1, 0)) sfx.move();
	else if ((key === 'ArrowRight' || key === 'd') && move(1, 0)) sfx.move();
	else if (key === 'ArrowDown' || key === 's') {
		if (move(0, 1)) score++;
		lastDrop = performance.now();
	} else if (key === 'ArrowUp' || key === 'x' || key === 'w') turn(1);
	else if (key === 'z') turn(-1);
	else if (key === ' ') {
		while (move(0, 1)) score += 2;
		sfx.drop();
		lock();
	} else if (!['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(key)) return;
	e.preventDefault();
});

canvas.focus();
requestAnimationFrame(frame);
