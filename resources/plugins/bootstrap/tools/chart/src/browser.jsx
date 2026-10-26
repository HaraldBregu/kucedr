import { createRoot } from 'react-dom/client';
import { Chart } from './chart.jsx';

const input = JSON.parse(document.getElementById('chart-input').textContent);
createRoot(document.getElementById('chart')).render(<Chart input={input} />);
