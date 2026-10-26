const SIZE = 20;
const CELLS = 20;
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const DIRS = {
	ArrowUp: [0, -1], w: [0, -1],
	ArrowDown: [0, 1], s: [0, 1],
	ArrowLeft: [-1, 0], a: [-1, 0],
	ArrowRight: [1, 0], d: [1, 0],
};

let snake, dir, nextDir, food, score, over, paused;

function reset() {
	snake = [[10, 10], [9, 10], [8, 10]];
	dir = nextDir = [1, 0];
	score = 0;
	over = paused = false;
	placeFood();
}

function placeFood() {
	do food = [Math.floor(Math.random() * CELLS), Math.floor(Math.random() * CELLS)];
	while (snake.some(([x, y]) => x === food[0] && y === food[1]));
}

function step() {
	if (over || paused) return;
	dir = nextDir;
	const head = [snake[0][0] + dir[0], snake[0][1] + dir[1]];
	const hitWall = head[0] < 0 || head[1] < 0 || head[0] >= CELLS || head[1] >= CELLS;
	const hitSelf = snake.slice(0, -1).some(([x, y]) => x === head[0] && y === head[1]);
	if (hitWall || hitSelf) {
		over = true;
		return;
	}
	snake.unshift(head);
	if (head[0] === food[0] && head[1] === food[1]) {
		score++;
		placeFood();
	} else {
		snake.pop();
	}
}

function draw() {
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = '#e33';
	ctx.fillRect(food[0] * SIZE, food[1] * SIZE, SIZE - 1, SIZE - 1);
	ctx.fillStyle = '#3c3';
	for (const [x, y] of snake) ctx.fillRect(x * SIZE, y * SIZE, SIZE - 1, SIZE - 1);
	scoreEl.textContent = `Score: ${score}`;
	if (over || paused) {
		ctx.fillStyle = '#fff';
		ctx.font = '24px system-ui';
		ctx.textAlign = 'center';
		ctx.fillText(over ? 'Game over — Enter to restart' : 'Paused', canvas.width / 2, canvas.height / 2);
	}
}

document.addEventListener('keydown', (e) => {
	const d = DIRS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
	if (d && (d[0] !== -dir[0] || d[1] !== -dir[1])) nextDir = d;
	else if (e.key === ' ') paused = !paused;
	else if (e.key === 'Enter' && over) reset();
	else return;
	e.preventDefault();
});

reset();
canvas.focus();
setInterval(() => {
	step();
	draw();
}, 120);
