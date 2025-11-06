import { fmtCurrency, fmtCompact, fmtPct, el, $, $$, debounce } from './utils.js';
import { getState, toggleWatch, inWatchlist } from './state.js';
import { renderSparkline } from './charts.js';

let currentSort = { key: 'market_cap', dir: 'desc' };
let searchQuery = '';
let filterTop = 100;
let page = 1;
let perPage = 100; // We fetch top 100 and then slice by filters
let allRows = []; // flattened array of items for current currency
let sentinelObserver;

export function initTable(){
  const root = $('#table-root');
  root.innerHTML = '';
}

export function setFilterTop(n){
  filterTop = n;
  renderTable();
}

export function setSearch(q){
  searchQuery = q.trim().toLowerCase();
  renderTable();
}

export function setSort(key){
  if(currentSort.key === key){
    currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort.key = key;
    currentSort.dir = 'desc';
  }
  renderTable();
}

export function updateData(items){
  allRows = items; // fresh payload
  page = 1;
  renderTable(true);
}

function applyFilters(items){
  let out = items.slice(0, filterTop);
  if(searchQuery){
    out = out.filter(x =>
      x.name.toLowerCase().includes(searchQuery) ||
      x.symbol.toLowerCase().includes(searchQuery));
  }
  return out;
}

function sortItems(items){
  const { key, dir } = currentSort;
  const mul = dir === 'asc' ? 1 : -1;
  const val = (row) => {
    switch(key){
      case 'rank': return row.market_cap_rank ?? Number.MAX_SAFE_INTEGER;
      case 'coin': return row.name.toLowerCase();
      case 'price': return row.current_price ?? 0;
      case '1h': return row.price_change_percentage_1h_in_currency ?? 0;
      case '24h': return row.price_change_percentage_24h_in_currency ?? 0;
      case '7d': return row.price_change_percentage_7d_in_currency ?? 0;
      case 'volume': return row.total_volume ?? 0;
      case 'market_cap': return row.market_cap ?? 0;
      case 'supply': return row.circulating_supply ?? 0;
      default: return 0;
    }
  };
  return items.sort((a,b)=>{
    const va = val(a), vb = val(b);
    if(typeof va === 'string' || typeof vb === 'string'){
      return va.localeCompare(vb) * mul;
    } else {
      return (va - vb) * mul;
    }
  });
}

function buildTable(rows){
  const { currency } = getState();
  const table = el('table', { class:'market', role:'table' });
  table.appendChild(el('caption', {}, 'Live market prices — data from CoinGecko'));

  const thead = el('thead', {}, el('tr', {},
    th('rank', '#'),
    th('coin', 'Coin', { class:'sticky' }),
    th('price', 'Price'),
    th('1h', '1h %'),
    th('24h', '24h %'),
    th('7d', '7d %'),
    th('volume col-volume', '24h Volume'),
    th('market_cap', 'Market Cap'),
    th('supply col-supply', 'Circulating'),
    el('th', { scope:'col' }, 'Sparkline'),
    el('th', { scope:'col' }, '★')
  ));
  const tbody = el('tbody');

  for(const row of rows){
    const tr = el('tr', { tabindex:'-1' });
    const pct1h = fmtPct(row.price_change_percentage_1h_in_currency);
    const pct24 = fmtPct(row.price_change_percentage_24h_in_currency);
    const pct7d = fmtPct(row.price_change_percentage_7d_in_currency);

    const coinCell = el('th', { scope:'row', class:'sticky' },
      el('div', { class:'coin' },
        el('img', { src: row.image, alt: `${row.name} logo`, width:'20', height:'20', loading:'lazy', referrerpolicy:'no-referrer' }),
        el('div', {}, el('div', {}, row.name), el('div', { class:'rank' }, row.symbol.toUpperCase()))
      )
    );

    const spark = el('canvas', { class:'spark', width:'140', height:'40' });
    // Color spark by 7d direction
    const stroke = (row.price_change_percentage_7d_in_currency ?? 0) >= 0 ? getComputedStyle(document.documentElement).getPropertyValue('--accent-up') : getComputedStyle(document.documentElement).getPropertyValue('--accent-down');

    const star = el('button', {
      class:'star',
      'aria-label': inWatchlist(row.id) ? 'Remove from watchlist' : 'Add to watchlist',
      'aria-pressed': String(inWatchlist(row.id)),
      onclick: (e)=> {
        e.stopPropagation();
        toggleWatch(row.id);
        star.setAttribute('aria-pressed', String(inWatchlist(row.id)));
      }
    }, '★');

    tr.addEventListener('click', ()=>{
      const url = new URL(location.href);
      url.searchParams.set('coin', row.id);
      history.pushState({}, '', url);
      const evt = new CustomEvent('open-coin', { detail: { id: row.id } });
      window.dispatchEvent(evt);
    });

    tbody.append(
      tr,
      tr.appendChild(el('td', { class:'numeric' }, String(row.market_cap_rank ?? '—'))),
      tr.appendChild(coinCell),
      tr.appendChild(el('td', { class:'numeric' }, fmtCurrency(row.current_price, currency))),
      tr.appendChild(el('td', { class:`numeric price-${pct1h.dir}` }, pct1h.text)),
      tr.appendChild(el('td', { class:`numeric price-${pct24.dir}` }, pct24.text)),
      tr.appendChild(el('td', { class:`numeric price-${pct7d.dir}` }, pct7d.text)),
      tr.appendChild(el('td', { class:'numeric col-volume' }, fmtCompact(row.total_volume))),
      tr.appendChild(el('td', { class:'numeric' }, fmtCompact(row.market_cap))),
      tr.appendChild(el('td', { class:'numeric col-supply' }, fmtCompact(row.circulating_supply))),
      tr.appendChild(el('td', { class:'spark' }, spark)),
      tr.appendChild(el('td', {}, star))
    );

    // Defer sparkline draw until visible
    const io = new IntersectionObserver((entries, ob)=>{
      for(const ent of entries){
        if(ent.isIntersecting){
          const prices = row?.sparkline_in_7d?.price || [];
          renderSparkline(spark, prices.slice(-60), { stroke: String(stroke).trim() || '#9ca3af' });
          ob.unobserve(ent.target);
        }
      }
    }, { root: null, threshold: 0.15 });
    io.observe(spark);
  }

  table.appendChild(thead); table.appendChild(tbody);
  return table;
}

function th(key, label, extra={}) {
  const isSorted = currentSort.key === key;
  const th = el('th', { scope:'col', class: extra.class || '' , tabindex:'0' }, label);
  if(key) {
    th.setAttribute('role','columnheader');
    th.dataset.key = key;
    th.setAttribute('aria-sort', isSorted ? (currentSort.dir === 'asc' ? 'ascending' : 'descending') : 'none');
    const handler = ()=> setSort(key);
    th.addEventListener('click', handler);
    th.addEventListener('keydown', (e)=>{ if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }});
  }
  return th;
}

function buildCards(rows){
  const { currency } = getState();
  const wrap = el('div', { class:'cards', role:'feed' });
  for(const row of rows){
    const pct24 = fmtPct(row.price_change_percentage_24h_in_currency);
    const card = el('article', { class:'card', tabindex:'0' });
    const spark = el('canvas', { class:'spark', width:'300', height:'48' });
    const stroke = (row.price_change_percentage_7d_in_currency ?? 0) >= 0 ? getComputedStyle(document.documentElement).getPropertyValue('--accent-up') : getComputedStyle(document.documentElement).getPropertyValue('--accent-down');

    card.append(
      el('div', { class:'coin' },
        el('img', { src: row.image, alt: `${row.name} logo`, width:'24', height:'24', loading:'lazy' }),
        el('strong', {}, row.name),
        el('span', { class:'rank' }, row.symbol.toUpperCase())
      ),
      el('div', { class:`numeric price-${pct24.dir}` }, `${fmtCurrency(row.current_price, currency)} · ${pct24.text}`),
      el('div', { class:'spark' }, spark),
    );

    card.addEventListener('click', ()=>{
      const url = new URL(location.href);
      url.searchParams.set('coin', row.id);
      history.pushState({}, '', url);
      window.dispatchEvent(new CustomEvent('open-coin', { detail: { id: row.id } }));
    });

    const io = new IntersectionObserver((entries, ob)=>{
      for(const ent of entries){
        if(ent.isIntersecting){
          const prices = row?.sparkline_in_7d?.price || [];
          renderSparkline(spark, prices.slice(-60), { stroke: String(stroke).trim() || '#9ca3af' });
          ob.unobserve(ent.target);
        }
      }
    }, { root: null, threshold: 0.15 });
    io.observe(spark);

    wrap.appendChild(card);
  }
  return wrap;
}

export function renderTable(reset=false){
  const root = $('#table-root');
  root.setAttribute('aria-busy', 'true');
  root.innerHTML = '';

  let rows = applyFilters(allRows);
  rows = sortItems(rows);

  const desktop = buildTable(rows);
  const mobile = buildCards(rows);

  root.appendChild(desktop);
  root.appendChild(mobile);
  root.removeAttribute('aria-busy');

  // Infinite scroll sentinel, for when perPage < 250 + pagination choice
  setupSentinel();
}

function setupSentinel(){
  const sentinel = document.getElementById('sentinel');
  sentinelObserver && sentinelObserver.disconnect();
  sentinelObserver = new IntersectionObserver((entries)=>{
    for(const ent of entries){
      if(ent.isIntersecting){
        // If we ever implement true pagination from API, we'd fetch next page here.
        // For now, perPage=100 + filters means we don't need to load more; keep placeholder.
      }
    }
  }, { root: null, threshold: 0.1 });
  sentinelObserver.observe(sentinel);
}

// Public hook to filter by watchlist
export function filterToWatchlist(){
  const { watchlist } = getState();
  const ids = new Set(watchlist);
  const only = allRows.filter(r => ids.has(r.id));
  const root = $('#table-root');
  root.innerHTML = '';
  const rows = sortItems(only);
  root.appendChild(buildTable(rows));
  root.appendChild(buildCards(rows));
}
