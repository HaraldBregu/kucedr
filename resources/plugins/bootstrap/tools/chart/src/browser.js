// Bundled into dist/browser.js and inlined into every chart page by index.mjs.
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);
window.Chart = Chart;
