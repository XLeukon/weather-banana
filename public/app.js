const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const els = {
  search: $('#search'),
  results: $('#results'),
  status: $('#status'),
  imageWrap: $('#image-wrap'),
  image: $('#city-image'),
  meta: $('#meta'),
  cityLine: $('#city-line'),
  conditionsLine: $('#conditions-line'),
};

let citiesIndex = [];
let selectedCity = null; // { name, lat, lon }

// Load cities once
async function loadCities() {
  const res = await fetch('cities500.json');
  if (!res.ok) throw new Error('Could not load cities500.json');
  const data = await res.json();
  const arr = Array.isArray(data) ? data : data?.cities || [];
  citiesIndex = arr.map(normalizeCity).filter(Boolean);
}

function normalizeCity(raw) {
  if (!raw) return null;
  const name = raw.name || raw.ascii || raw.city || raw.town || raw.display_name;
  const country = raw.country || raw.countryCode || raw.cc || raw.country_name;
  const lat = coerceNumber(raw.lat ?? raw.latitude ?? raw.y ?? raw.coord?.lat);
  const lon = coerceNumber(raw.lon ?? raw.lng ?? raw.longitude ?? raw.x ?? raw.coord?.lon);
  if (!name || lat == null || lon == null) return null;
  return { name, country, lat, lon };
}

function coerceNumber(v) {
  if (v == null) return null;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

function renderResults(matches) {
  els.results.innerHTML = '';
  matches.slice(0, 30).forEach((c) => {
    const li = document.createElement('li');
    const left = document.createElement('div');
    left.className = 'name';
    left.textContent = c.name;
    const right = document.createElement('div');
    right.className = 'meta';
    right.textContent = [c.country, `${c.lat.toFixed(2)}, ${c.lon.toFixed(2)}`].filter(Boolean).join(' • ');
    li.appendChild(left);
    li.appendChild(right);
    li.addEventListener('click', () => onCitySelected(c));
    els.results.appendChild(li);
  });
}

function fuzzyIncludes(hay, needle) {
  return hay.toLowerCase().includes(needle.toLowerCase());
}

els.search.addEventListener('input', () => {
  const q = els.search.value.trim();
  if (!q) {
    els.results.innerHTML = '';
    return;
  }
  const matches = citiesIndex.filter((c) => fuzzyIncludes(c.name, q));
  renderResults(matches);
});

async function onCitySelected(city) {
  try {
    selectedCity = city; // store coordinates here
    els.results.innerHTML = '';
    els.search.value = `${city.name}${city.country ? ', ' + city.country : ''}`;

    setStatus(`Fetching weather for ${city.name}...`);
    const summary = await fetchNextHourWeather(city.lat, city.lon);

    setStatus(`Generating image...`);
    const imagePath = await generateCityImage(city.name, summary.text, summary.localTime);

    // Update UI
    els.image.src = imagePath;
    els.imageWrap.classList.remove('hidden');
    els.meta.classList.remove('hidden');
    const tempC = summary.temperature;
    const tempF = cToF(tempC);
    els.cityLine.textContent = `${city.name}${city.country ? ', ' + city.country : ''}, ${round(tempC)}°C (${round(tempF)}°F)`;
    els.conditionsLine.textContent = summary.text;
    clearStatus();
  } catch (e) {
    showError(e);
  }
}

async function fetchNextHourWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: [
      'temperature_2m','relative_humidity_2m','rain','showers','snowfall','snow_depth','precipitation','precipitation_probability','apparent_temperature','dew_point_2m','weather_code','pressure_msl','surface_pressure','cloud_cover','cloud_cover_low','cloud_cover_mid','cloud_cover_high','visibility','vapour_pressure_deficit','wind_gusts_10m','wind_direction_10m','wind_speed_10m'
    ].join(','),
    forecast_days: '1',
    timezone: 'auto'
  }).toString();
  const url = `https://api.open-meteo.com/v1/forecast?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load weather');
  const data = await res.json();
  const h = data.hourly || {};
  const times = h.time || [];
  const idx = pickNextHourIndex(times);
  const toNum = (arr) => (Array.isArray(arr) && arr[idx] != null ? Number(arr[idx]) : null);
  const temperature = toNum(h.temperature_2m);
  const appTemp = toNum(h.apparent_temperature);
  const pop = toNum(h.precipitation_probability);
  const precip = toNum(h.precipitation);
  const rain = toNum(h.rain);
  const showers = toNum(h.showers);
  const snowfall = toNum(h.snowfall);
  const cloud = toNum(h.cloud_cover);
  const wind = toNum(h.wind_speed_10m);
  const gust = toNum(h.wind_gusts_10m);
  const wcode = toNum(h.weather_code);

  const desc = describeWeather({ temperature, appTemp, pop, precip, rain, showers, snowfall, cloud, wind, gust, wcode });
  const tz = data.timezone || null;
  const localTime = formatLocalTime(tz);
  return { temperature: round(temperature), text: desc, timezone: tz, localTime };
}

function pickNextHourIndex(times) {
  const now = new Date();
  let bestIdx = 0;
  let bestTime = Infinity;
  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]);
    const diff = t - now;
    if (diff >= 0 && diff < bestTime) { bestTime = diff; bestIdx = i; }
  }
  return bestIdx;
}

function describeWeather({ temperature, appTemp, pop, precip, rain, showers, snowfall, cloud, wind, gust, wcode }) {
  const parts = [];
  const codeText = weatherCodeText(wcode);
  if (codeText) parts.push(codeText);

  if (typeof cloud === 'number') {
    if (cloud < 15) parts.push('clear sky');
    else if (cloud < 50) parts.push('partly cloudy');
    else parts.push('overcast');
  }
  if (typeof wind === 'number') {
    if (wind >= 50) parts.push('stormy');
    else if (wind >= 25) parts.push('windy');
  }
  if (typeof pop === 'number' && pop >= 40) parts.push(`precip. chance ${pop}%`);
  if (typeof precip === 'number' && precip > 0) parts.push(`${precip.toFixed(1)} mm precipitation`);
  if (typeof rain === 'number' && rain > 0) parts.push(`${rain.toFixed(1)} mm rain`);
  if (typeof showers === 'number' && showers > 0) parts.push('showers');
  if (typeof snowfall === 'number' && snowfall > 0) parts.push('snowfall');

  const base = parts.filter(Boolean).join(', ');
  return base;
}

function weatherCodeText(code) {
  const map = {
    0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'cloudy',
    45: 'fog', 48: 'freezing fog',
    51: 'light drizzle', 53: 'moderate drizzle', 55: 'heavy drizzle',
    56: 'light freezing drizzle', 57: 'heavy freezing drizzle',
    61: 'light rain', 63: 'moderate rain', 65: 'heavy rain',
    66: 'light freezing rain', 67: 'heavy freezing rain',
    71: 'light snow', 73: 'moderate snow', 75: 'heavy snow', 77: 'snow grains',
    80: 'light rain showers', 81: 'moderate rain showers', 82: 'heavy rain showers',
    85: 'light snow showers', 86: 'heavy snow showers',
    95: 'thunderstorm', 96: 'thunderstorm with light hail', 99: 'thunderstorm with heavy hail'
  };
  return map[code] || '';
}

function round(n) { return Math.round((n + Number.EPSILON) * 10) / 10; }
function cToF(c) { return c * 9/5 + 32; }

function formatLocalTime(timeZone) {
  try {
    const opts = { hour: '2-digit', minute: '2-digit', hour12: false };
    if (timeZone) opts.timeZone = timeZone;
    return new Intl.DateTimeFormat('en-GB', opts).format(new Date());
  } catch {
    // Fallback to browser local time
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  }
}

async function generateCityImage(city, conditionsText, localTime) {
  const res = await fetch('api/generate-image-google2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ city, conditions: conditionsText, localTime, size: '1024x1024' })
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  if (!res.ok) {
    const detail = data?.detail || data?.error || text;
    throw new Error(`Image generation failed (${res.status}).\n${detail}`);
  }
  if (data?.fallback) {
    setStatus(`Note: Using fallback image. Reason: ${data.reason || 'unknown'}`);
  }
  return data.path; // /img/<file>.png or .svg
}

// Init
(async () => {
  try {
    await loadCities();
  } catch (e) {
    showError(e);
  }
})();

function setStatus(msg){
  if (!els.status) return;
  els.status.classList.remove('error');
  els.status.innerHTML = msg;
}
function clearStatus(){ if (els.status) els.status.textContent = ''; }
function showError(err){
  if (!els.status) return console.error(err);
  els.status.classList.add('error');
  const msg = (err && err.message) ? err.message : String(err);
  els.status.innerHTML = `Error:<div class="mono">${escapeHtml(msg)}</div>`;
}
function escapeHtml(s){
  return String(s).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
