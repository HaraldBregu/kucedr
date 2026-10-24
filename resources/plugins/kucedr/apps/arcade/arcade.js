const GAMES = [
	{ id: 'space-invaders', title: 'Space Invaders' },
	{ id: 'breakout', title: 'Breakout' },
	{ id: 'asteroids', title: 'Asteroids' },
	{ id: 'lunar-lander', title: 'Lunar Lander' },
	{ id: 'galaga', title: 'Galaga' },
	{ id: 'pacman', title: 'Pac-Man' },
	{ id: 'snake', title: 'Snake' },
];
const attract = document.getElementById('attract');
const select = document.getElementById('select');
const list = document.getElementById('games');
const state = new URLSearchParams(location.hash.slice(1));

let credits = Number(state.get('credits')) || 0;
let selected = 0;
let screen = state.get('screen') === 'select' && credits > 0 ? 'select' : 'attract';

for (const [index, game] of GAMES.entries()) {
	const item = document.createElement('li');
	item.setAttribute('role', 'option');
	item.innerHTML = `<img src="games/${game.id}/icon.svg" alt="" /><span>${game.title}</span>`;
	item.addEventListener('click', () => {
		selected = index;
		play();
	});
	list.append(item);
}

function render() {
	attract.hidden = screen !== 'attract';
	select.hidden = screen !== 'select';
	for (const count of document.querySelectorAll('.count')) count.textContent = credits;
	for (const [index, item] of [...list.children].entries())
		item.setAttribute('aria-selected', index === selected);
}

function play() {
	if (credits === 0) return;
	location.href = `games/${GAMES[selected].id}/index.html#credits=${credits - 1}`;
}

document.addEventListener('keydown', (event) => {
	if (event.code === 'KeyC' || event.code === 'Digit5') credits++;
	else if (event.key === 'Escape' && screen === 'select') screen = 'attract';
	else if (event.key === 'Enter' && screen === 'attract' && credits > 0) screen = 'select';
	else if (event.key === 'Enter' && screen === 'select') play();
	else if (event.key === 'ArrowUp' && screen === 'select') selected = (selected + GAMES.length - 1) % GAMES.length;
	else if (event.key === 'ArrowDown' && screen === 'select') selected = (selected + 1) % GAMES.length;
	else return;
	event.preventDefault();
	render();
});

render();
