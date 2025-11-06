// Chart helpers. We render table sparklines via lightweight <canvas> drawing.
// For detail modal charts, we lazy-import Chart.js ESM from jsdelivr.

const CHART_JS_URL = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.6/dist/chart.umd.min.js';

let ChartLib = null;
async function ensureChartJs(){
  if(ChartLib) return ChartLib;
  // modulepreload via <link> is not necessary; we fetch on demand.
  const mod = await import(/* @vite-ignore */ CHART_JS_URL);
  ChartLib = mod.default || mod.Chart || window.Chart;
  return ChartLib;
}

export async function renderLineChart(canvas, labels, data, {color, gridColor, tooltipFmt}={}){
  const Chart = await ensureChartJs();
  const ctx = canvas.getContext('2d');
  const existing = Chart.getChart(canvas);
  if(existing) existing.destroy();
  // Respect theme via CSS variables
  const cs = getComputedStyle(document.documentElement);
  const fg = cs.getPropertyValue('--fg').trim() || '#e5e7eb';
  const border = cs.getPropertyValue('--border').trim() || '#1f2937';
  const up = cs.getPropertyValue('--accent-up').trim() || '#16a34a';
  const down = cs.getPropertyValue('--accent-down').trim() || '#ef4444';

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: color || fg,
        pointRadius: 0,
        tension: .25,
        fill: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { color: gridColor || border }, ticks: { display: false } },
        y: { grid: { color: gridColor || border }, ticks: { display: false } }
      },
      plugins: {
        legend: { display:false },
        tooltip: {
          callbacks: { label: (ctx) => tooltipFmt ? tooltipFmt(ctx.parsed.y) : String(ctx.parsed.y) }
        }
      }
    }
  });
}

export function renderSparkline(canvas, data, {stroke='#9ca3af'}={}){
  if(!data || !data.length) return;
  const w = canvas.width = canvas.clientWidth || 140;
  const h = canvas.height = canvas.clientHeight || 40;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,w,h);

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = (max - min) || 1;
  const xs = data.map((_,i)=> i * (w/(data.length-1)));
  const ys = data.map(v => h - ((v - min) / range) * (h-2) - 1);

  ctx.lineWidth = 2;
  ctx.strokeStyle = stroke;
  ctx.beginPath();
  ctx.moveTo(xs[0], ys[0]);
  for(let i=1;i<xs.length;i++) ctx.lineTo(xs[i], ys[i]);
  ctx.stroke();
}
