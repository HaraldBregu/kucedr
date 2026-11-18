const $ = (id) => document.getElementById(id)

// ponytail: sample data, wire to the app store or a real source when there is one
const RANGES = {
	today: { label: 'Today so far', energy: 71, delta: '+7% vs yesterday', labels: ['6', '9', '12', '15', '18', '21', '24'], bars: [35, 62, 80, 71, 66, 48, 30], on: 3, sleep: '7h 10m', score: 'Score 81 · Good' },
	week: { label: 'Average this week', energy: 64, delta: '−3% vs last week', labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'], bars: [60, 72, 50, 84, 66, 38, 56], on: 3, sleep: '7h 42m', score: 'Score 86 · Restful' },
	month: { label: 'Average this month', energy: 67, delta: '+2% vs last month', labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'], bars: [58, 64, 70, 61, 75, 67, 64], on: 4, sleep: '7h 28m', score: 'Score 83 · Steady' }
}
const SLEEP = [3, 2, 4, 3, 4, 2, 3, 1, 2, 0, 0, 0]
const FOCUS_SECONDS = 60 * 60

const now = new Date()
const hour = now.getHours()
$('greeting').textContent = `Good ${hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}, Mira`
$('date').textContent = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

function show(range) {
	const data = RANGES[range]
	for (const tab of document.querySelectorAll('[role=tab]')) tab.setAttribute('aria-selected', tab.dataset.range === range)
	$('energy-label').textContent = data.label
	$('energy-value').innerHTML = `${data.energy}<small>%</small>`
	$('energy-delta').textContent = data.delta
	$('sleep-value').textContent = data.sleep
	$('sleep-score').textContent = data.score
	$('bars').innerHTML = data.bars.map((value, index) => `<div class="${index === data.on ? 'on' : ''}"><i data-v="${value}" style="--v:${value}%"></i>${data.labels[index]}</div>`).join('')
}

document.querySelector('.tabs').addEventListener('click', (event) => {
	if (event.target.dataset.range) show(event.target.dataset.range)
})
show('week')

$('dots').innerHTML = [0, 1, 2, 3].map((row) => SLEEP.map((depth, column) => {
	const lit = depth >= 4 - row
	return `<i class="${lit ? (depth === 4 - row && column % 2 ? 'hi' : 'on') : ''}"></i>`
}).join('')).join('')

$('wave').innerHTML = Array.from({ length: 36 }, (_, index) => `<i style="--h:${Math.round(14 + 50 * Math.abs(Math.sin(index / 3.4)))}px;--d:${-(index % 7) * 0.17}s"></i>`).join('')

let remaining = 44 * 60 + 56
let running = true

function tick() {
	$('timer').textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`
	$('arc').parentElement.style.setProperty('--p', 100 * (1 - remaining / FOCUS_SECONDS))
}

function focus(on) {
	running = on && remaining > 0
	$('focus-state').textContent = `Deep work · ${running ? 'on' : 'off'}`
	$('focus-toggle').textContent = running ? 'Stop' : 'Start'
}

setInterval(() => {
	if (!running) return
	remaining -= 1
	tick()
	if (remaining === 0) {
		focus(false)
		remaining = FOCUS_SECONDS
	}
}, 1000)
tick()

$('focus-toggle').addEventListener('click', () => {
	focus(!running)
	tick()
})

$('sound-toggle').addEventListener('click', () => {
	const paused = document.querySelector('.sounds').classList.toggle('paused')
	$('sound-state').textContent = paused ? 'Paused' : 'Playing'
	$('sound-toggle').setAttribute('aria-label', paused ? 'Play' : 'Pause')
})
