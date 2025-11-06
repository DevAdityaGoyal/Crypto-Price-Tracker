import { fmtCurrency, fmtCompact, el, $, timeAgo } from './utils.js';
import { getState, toggleWatch, inWatchlist } from './state.js';
import { fetchCoinDetail } from './api.js';
import { renderLineChart } from './charts.js';

let currentId = null;

export function initDetail(){
  window.addEventListener('open-coin', (e)=> openDetail(e.detail.id));
  // Deep link support (?coin=bitcoin)
  const id = new URL(location.href).searchParams.get('coin');
  if(id) openDetail(id);
  window.addEventListener('popstate', ()=> {
    const id2 = new URL(location.href).searchParams.get('coin');
    if(!id2) closeDetail();
  });
}

export async function openDetail(id){
  currentId = id;
  const root = $('#modal-root');
  root.innerHTML = '';

  const backdrop = el('div', { class:'modal-backdrop', role:'dialog', 'aria-modal':'true', 'aria-labelledby':'coin-title' });
  const modal = el('div', { class:'modal' });

  const closeBtn = el('button', { class:'icon-btn', 'aria-label':'Close (Esc)' }, '✕');
  closeBtn.addEventListener('click', closeDetail);

  modal.append(
    el('header', {},
      el('div', { class:'coin-head'},
        el('div', { style:'display:flex;align-items:center;gap:.5rem' },
          el('img', { id:'coin-logo', src:'', alt:'', width:'28', height:'28' }),
          el('h2', { id:'coin-title' }, '…')
        )
      ),
      el('div', { style:'display:flex;gap:.5rem;align-items:center' },
        el('button', { id:'detail-watch', class:'chip', 'aria-pressed':'false' }, '★ Watch'),
        closeBtn
      )
    ),
    el('div', { class:'content' },
      el('div', { class:'grid' },
        stat('Rank', '—'),
        stat('Market Cap', '—'),
        stat('FDV', '—'),
        stat('Circulating', '—'),
        stat('ATH', '—'),
        stat('ATL', '—')
      ),
      el('div', { class:'tabs' },
        el('button', { class:'active', 'data-range':'7' }, '7d'),
        el('button', { 'data-range':'30' }, '30d'),
        el('button', { 'data-range':'90' }, '90d')
      ),
      el('div', { class:'chart' }, el('canvas', { id:'detail-chart', width:'900', height:'300' })),
      el('div', { class:'muted', id:'detail-updated' }, '')
    )
  );
  backdrop.appendChild(modal);
  root.appendChild(backdrop);

  backdrop.addEventListener('click', (e)=> { if(e.target === backdrop) closeDetail(); });
  document.addEventListener('keydown', escToClose);

  // Load data
  const { currency } = getState();
  const { data, ts } = await fetchCoinDetail(id);
  // Header
  $('#coin-logo').src = data.image.large;
  $('#coin-logo').alt = `${data.name} logo`;
  $('#coin-title').textContent = `${data.name} (${data.symbol.toUpperCase()})`;
  const watchBtn = $('#detail-watch');
  watchBtn.setAttribute('aria-pressed', String(inWatchlist(id)));
  watchBtn.innerHTML = inWatchlist(id) ? '★ Watching' : '★ Watch';
  watchBtn.onclick = () => {
    toggleWatch(id);
    watchBtn.setAttribute('aria-pressed', String(inWatchlist(id)));
    watchBtn.innerHTML = inWatchlist(id) ? '★ Watching' : '★ Watch';
  };

  // Stats
  const m = data.market_data;
  setStat(0, `#${m.market_cap_rank ?? '—'}`);
  setStat(1, fmtCurrency(m.market_cap?.[currency.toLowerCase()] ?? 0, currency));
  setStat(2, m.fully_diluted_valuation?.[currency.toLowerCase()] ? fmtCurrency(m.fully_diluted_valuation[currency.toLowerCase()], currency) : '—');
  setStat(3, fmtCompact(m.circulating_supply));
  setStat(4, `${fmtCurrency(m.ath?.[currency.toLowerCase()] ?? 0, currency)} (${new Date(m.ath_date?.[currency.toLowerCase()] || '').toLocaleDateString() || '—'})`);
  setStat(5, `${fmtCurrency(m.atl?.[currency.toLowerCase()] ?? 0, currency)} (${new Date(m.atl_date?.[currency.toLowerCase()] || '').toLocaleDateString() || '—'})`);

  $('#detail-updated').textContent = `Last updated ${timeAgo(ts)} — data: CoinGecko`;

  // Chart
  let range = 7;
  const btns = Array.from(document.querySelectorAll('.tabs button'));
  btns.forEach(b => b.addEventListener('click', async ()=>{
    btns.forEach(x=>x.classList.remove('active')); b.classList.add('active');
    range = Number(b.dataset.range);
    await draw(range);
  }));
  await draw(range);

  async function draw(days){
    const prices = await getSeries(data, days);
    const labels = prices.map(p=> new Date(p[0]).toLocaleDateString());
    const values = prices.map(p=> p[1]);
    const canvas = document.getElementById('detail-chart');
    await renderLineChart(canvas, labels, values, {
      tooltipFmt: (v)=> fmtCurrency(v, currency)
    });
  }
}

function stat(label, value){
  return el('div', { class:'stat' }, el('div', { class:'muted' }, label), el('div', { class:'value' }, value));
}
function setStat(idx, value){
  const nodes = document.querySelectorAll('.stat .value');
  if(nodes[idx]) nodes[idx].textContent = value;
}

async function getSeries(detail, days){
  // We already have sparkline 7d in detail; for 30/90 fetch market chart
  if(days === 7 && detail?.market_data?.sparkline_7d?.price?.length){
    const now = Date.now();
    const step = Math.floor(detail.market_data.sparkline_7d.price.length / 50);
    return detail.market_data.sparkline_7d.price.map((v,i)=> [now - (detail.market_data.sparkline_7d.price.length-i)*3600*1000, v]);
  }
  const id = detail.id;
  const cur = getState().currency.toLowerCase();
  const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=${cur}&days=${days}`;
  const res = await fetch(url);
  const json = await res.json();
  return json.prices || [];
}

export function closeDetail(){
  currentId = null;
  const root = $('#modal-root'); root.innerHTML = '';
  document.removeEventListener('keydown', escToClose);
  const url = new URL(location.href);
  url.searchParams.delete('coin');
  history.pushState({}, '', url);
}

function escToClose(e){ if(e.key === 'Escape') closeDetail(); }
