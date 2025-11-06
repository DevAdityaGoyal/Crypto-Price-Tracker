// CoinGecko API client with sessionStorage caching, exponential backoff,
// abortable requests, SWR friendliness. No API keys required.
const API = 'https://api.coingecko.com/api/v3';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function withBackoff(fetchFn, { tries = 4, base = 500 } = {}) {
  let attempt = 0, lastErr;
  while (attempt < tries) {
    try { return await fetchFn(); }
    catch (e) {
      lastErr = e;
      // Respect 429 Retry-After if present
      const retryAfter = Number(e?.retryAfterMs || 0);
      const wait = retryAfter || (base * 2 ** attempt + Math.random() * 100);
      await sleep(wait);
      attempt++;
    }
  }
  throw lastErr;
}

const cacheKey = (key, params) => `${key}:${JSON.stringify(params)}`;
const ssGet = (k) => { try{ return JSON.parse(sessionStorage.getItem(k) || 'null'); }catch{return null;} };
const ssSet = (k,v) => { try{ sessionStorage.setItem(k, JSON.stringify(v)); }catch{} };

async function fetchJson(url, signal){
  const res = await fetch(url, { headers: { 'accept': 'application/json' }, signal });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    const ra = res.headers.get('Retry-After');
    if (ra) err.retryAfterMs = (Number(ra) || 1) * 1000;
    throw err;
  }
  return res.json();
}

export async function fetchMarkets({ vsCurrency = 'USD', page = 1, perPage = 100 } = {}, { useCache=true } = {}) {
  const params = new URLSearchParams({
    vs_currency: vsCurrency.toLowerCase(),
    order: 'market_cap_desc',
    per_page: String(perPage),
    page: String(page),
    sparkline: 'true',
    price_change_percentage: '1h,24h,7d'
  });
  const url = `${API}/coins/markets?${params.toString()}`;
  const key = cacheKey('markets', {vsCurrency,page,perPage});
  const cached = ssGet(key);

  // Return cached immediately (SWR pattern)
  let controller = new AbortController();
  const freshPromise = withBackoff(() => fetchJson(url, controller.signal));

  if (useCache && cached) {
    // Trigger background refresh but return cached first
    freshPromise.then(data => ssSet(key, { ts: Date.now(), data })).catch(()=>{});
    return { data: cached.data, fromCache: true, ts: cached.ts };
  }

  const data = await freshPromise;
  const out = { ts: Date.now(), data };
  ssSet(key, out);
  return { data, fromCache: false, ts: out.ts };
}

export async function fetchCoinDetail(id, { useCache=true } = {}) {
  const url = `${API}/coins/${encodeURIComponent(id)}?localization=false&tickers=false&market_data=true&sparkline=true`;
  const key = cacheKey('detail', {id});
  const cached = ssGet(key);

  let controller = new AbortController();
  const freshPromise = withBackoff(() => fetchJson(url, controller.signal));

  if (useCache && cached) {
    freshPromise.then(data => ssSet(key, { ts: Date.now(), data })).catch(()=>{});
    return { data: cached.data, fromCache: true, ts: cached.ts };
  }

  const data = await freshPromise;
  const out = { ts: Date.now(), data };
  ssSet(key, out);
  return { data, fromCache: false, ts: out.ts };
}
