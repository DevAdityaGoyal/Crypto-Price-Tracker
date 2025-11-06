// Reactive-ish global state store with subscribe pattern.
// Persists currency, theme, watchlist, settings (refreshInterval)
const LS_KEYS = {
  currency: 'cpt.currency',
  theme: 'cpt.theme',
  watchlist: 'cpt.watchlist',
  settings: 'cpt.settings',
};

const initial = {
  currency: localStorage.getItem(LS_KEYS.currency) || 'USD',
  theme: localStorage.getItem(LS_KEYS.theme) || 'auto',
  watchlist: new Set(JSON.parse(localStorage.getItem(LS_KEYS.watchlist) || '[]')),
  settings: (() => {
    try { return JSON.parse(localStorage.getItem(LS_KEYS.settings) || '{}'); }
    catch { return {}; }
  })(),
};

const subscribers = new Set();

function emit() {
  subscribers.forEach(fn => fn(getState()));
}

export function subscribe(fn){ subscribers.add(fn); return ()=>subscribers.delete(fn); }
export function getState(){
  return {
    currency: initial.currency,
    theme: initial.theme,
    watchlist: new Set(initial.watchlist),
    settings: { refreshInterval: initial.settings.refreshInterval || 30000 },
  };
}

export function setCurrency(cur){
  initial.currency = cur;
  localStorage.setItem(LS_KEYS.currency, cur);
  emit();
}

export function setTheme(theme){
  initial.theme = theme; // 'dark'|'light'|'auto'
  localStorage.setItem(LS_KEYS.theme, theme);
  applyTheme();
  emit();
}

export function toggleWatch(id){
  if(initial.watchlist.has(id)) initial.watchlist.delete(id);
  else initial.watchlist.add(id);
  localStorage.setItem(LS_KEYS.watchlist, JSON.stringify(Array.from(initial.watchlist)));
  emit();
}

export function setRefreshInterval(ms){
  initial.settings.refreshInterval = ms;
  localStorage.setItem(LS_KEYS.settings, JSON.stringify(initial.settings));
  emit();
}

export function inWatchlist(id){ return initial.watchlist.has(id); }

export function applyTheme(){
  const root = document.documentElement;
  if(initial.theme === 'auto'){
    root.removeAttribute('data-theme'); // let prefers-color-scheme drive
  } else {
    root.setAttribute('data-theme', initial.theme);
  }
}
