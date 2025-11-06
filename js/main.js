import { fetchMarkets } from './api.js';
import { initToasts, toast } from './ui-toasts.js';
import { initTable, updateData, renderTable, setFilterTop, setSearch, filterToWatchlist } from './ui-table.js';
import { getState, subscribe, setCurrency, setTheme, setRefreshInterval, applyTheme } from './state.js';
import { debounce, onKey, $, $$ } from './utils.js';
import { initDetail } from './ui-detail.js';
import { registerPWA } from './pwa.js';

const loader = $('#loader');
const lastUpdatedEl = $('#lastUpdated');
const offlineBanner = $('#offline-banner');

let pollingTimer = null;
let isWatchlistMode = false;
let backoffMs = 0;

init();

async function init(){
  initToasts();
  initTable();
  initDetail();
  bindHeader();
  applyTheme();
  await firstLoad();
  startPolling();
  registerPWA();
  bindKeyboardShortcuts();
  window.addEventListener('online', ()=> { offlineBanner.hidden = true; });
  window.addEventListener('offline', ()=> { offlineBanner.hidden = false; });
}

function bindHeader(){
  const search = $('#search');
  const currency = $('#currency');
  const themeToggle = $('#themeToggle');
  const filters = $$('.chip');
  const refresh = $('#refresh');

  search.addEventListener('input', debounce(e=> setSearch(e.target.value), 250));
  currency.value = getState().currency;
  currency.addEventListener('change', async (e)=>{
    setCurrency(e.target.value);
    await firstLoad(); // refresh data for currency
  });
  themeToggle.addEventListener('click', ()=>{
    const cur = getState().theme;
    const next = cur === 'dark' ? 'light' : cur === 'light' ? 'auto' : 'dark';
    setTheme(next);
    const label = next === 'dark' ? 'Dark' : next === 'light' ? 'Light' : 'Auto';
    toast(`Theme: ${label}`);
  });
  filters.forEach(btn => btn.addEventListener('click', ()=>{
    $$('.chip').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    setFilterTop(Number(btn.dataset.filter));
  }));

  $('#watchlistLink').addEventListener('click', (e)=>{
    e.preventDefault();
    isWatchlistMode = !isWatchlistMode;
    if(isWatchlistMode){
      $('#watchlistLink').textContent = 'All Coins';
      filterToWatchlist();
    } else {
      $('#watchlistLink').textContent = 'Watchlist';
      renderTable();
    }
  });

  refresh.value = String(getState().settings.refreshInterval);
  refresh.addEventListener('change', (e)=>{
    setRefreshInterval(Number(e.target.value));
    restartPolling();
    toast(`Refresh: ${Number(e.target.value)/1000}s`);
  });
}

function bindKeyboardShortcuts(){
  document.addEventListener('keydown', onKey('/', (e)=>{ e.preventDefault(); $('#search').focus(); }));
  document.addEventListener('keydown', onKey('t', ()=> $('#themeToggle').click() ));
  // 'w' toggling watch happens in row with focused star button via Enter/Space; global 'w' could interfere so we skip
}

async function firstLoad(){
  loader.hidden = false;
  try{
    const { currency } = getState();
    const { data, fromCache, ts } = await fetchMarkets({ vsCurrency: currency, page: 1, perPage: 100 });
    updateData(data);
    lastUpdatedEl.textContent = `Last updated ${new Date(ts).toLocaleTimeString()} ${fromCache ? '(cached)' : ''}`;
  }catch(e){
    toast(`Failed to load data: ${e.message}`, 'error');
    offlineBanner.hidden = !navigator.onLine;
  }finally{
    loader.hidden = true;
  }
}

function startPolling(){
  const { refreshInterval } = getState().settings;
  clearInterval(pollingTimer);
  pollingTimer = setInterval(async ()=>{
    try{
      const { currency } = getState();
      const res = await fetchMarkets({ vsCurrency: currency, page:1, perPage:100 }, { useCache: true });
      updateData(res.data);
      lastUpdatedEl.textContent = `Last updated ${new Date(res.ts).toLocaleTimeString()} ${res.fromCache ? '(cached)' : ''}`;
      backoffMs = 0;
    }catch(e){
      // Exponential backoff if 429/5xx: slow our polling
      toast('Rate limited or network error — backing off', 'error', { timeout: 2500 });
      backoffMs = backoffMs ? Math.min(backoffMs * 2, 120000) : 10000;
      restartPolling(backoffMs);
    }
  }, refreshInterval + backoffMs);
}

function restartPolling(delay=0){
  clearInterval(pollingTimer);
  setTimeout(startPolling, delay);
}
