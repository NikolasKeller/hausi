// One-off resolver: for each candidate world city, look up the RA GraphQL
// area id (exact name match) and probe candidate eventbrite.com /d/<slug>/
// pages for real SERVER_DATA results. Prints a report; nothing is written.
// Usage: node scripts/scrape/resolve-cities.mjs [ra|eb]

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const CANDIDATES = [
  // [name, searchTerm override (RA), eventbrite slug candidates]
  ['New York', null, ['ny--new-york']],
  ['Los Angeles', null, ['ca--los-angeles']],
  ['San Francisco', null, ['ca--san-francisco']],
  ['San Diego', null, ['ca--san-diego']],
  ['Chicago', null, ['il--chicago']],
  ['Miami', null, ['fl--miami']],
  ['Austin', null, ['tx--austin']],
  ['Dallas', null, ['tx--dallas']],
  ['Houston', null, ['tx--houston']],
  ['Atlanta', null, ['ga--atlanta']],
  ['Boston', null, ['ma--boston']],
  ['Philadelphia', null, ['pa--philadelphia']],
  ['Washington DC', 'Washington', ['dc--washington']],
  ['Seattle', null, ['wa--seattle']],
  ['Portland', null, ['or--portland']],
  ['Denver', null, ['co--denver']],
  ['Phoenix', null, ['az--phoenix']],
  ['Las Vegas', null, ['nv--las-vegas']],
  ['Minneapolis', null, ['mn--minneapolis']],
  ['Detroit', null, ['mi--detroit']],
  ['Nashville', null, ['tn--nashville']],
  ['New Orleans', null, ['la--new-orleans']],
  ['Toronto', null, ['canada--toronto']],
  ['Vancouver', null, ['canada--vancouver']],
  ['Montreal', null, ['canada--montreal']],
  ['Mexico City', null, ['mexico--mexico-city']],
  ['Bogotá', 'Bogota', ['colombia--bogota']],
  ['Buenos Aires', null, ['argentina--buenos-aires']],
  ['Santiago', null, ['chile--santiago']],
  ['São Paulo', 'Sao Paulo', ['brazil--sao-paulo']],
  ['Rio de Janeiro', null, ['brazil--rio-de-janeiro']],
  ['Sydney', null, ['australia--sydney']],
  ['Melbourne', null, ['australia--melbourne']],
  ['Tokyo', null, ['japan--tokyo']],
  ['Osaka', null, ['japan--osaka']],
  ['Kyoto', null, ['japan--kyoto']],
  ['Seoul', null, ['south-korea--seoul']],
  ['Hong Kong', null, ['hong-kong--hong-kong']],
  ['Taipei', null, ['taiwan--taipei']],
  ['Shanghai', null, ['china--shanghai']],
  ['Beijing', null, ['china--beijing']],
  ['Singapore', null, ['singapore--singapore']],
  ['Bangkok', null, ['thailand--bangkok']],
  ['Jakarta', null, ['indonesia--jakarta']],
  ['Manila', null, ['philippines--manila']],
  ['Delhi', 'New Delhi', ['india--new-delhi', 'india--delhi']],
  ['Mumbai', null, ['india--mumbai']],
  ['Dubai', null, ['united-arab-emirates--dubai']],
  ['Tel Aviv', null, ['israel--tel-aviv', 'israel--tel-aviv-yafo']],
  ['Istanbul', null, ['turkey--istanbul']],
  ['Cairo', null, ['egypt--cairo']],
  ['Cape Town', null, ['south-africa--cape-town']],
  ['Johannesburg', null, ['south-africa--johannesburg']],
  ['Nairobi', null, ['kenya--nairobi']],
  ['Lagos', null, ['nigeria--lagos']],
  ['Helsinki', null, ['finland--helsinki']],
  ['Geneva', null, ['switzerland--geneva']],
];

async function raArea(searchTerm) {
  const res = await fetch('https://ra.co/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA, Referer: 'https://ra.co/events' },
    body: JSON.stringify({
      query: 'query($s:String!){ areas(searchTerm:$s){ id name urlName country { name } } }',
      variables: { s: searchTerm },
    }),
  });
  if (!res.ok) return { error: res.status };
  const json = await res.json();
  return { areas: json?.data?.areas ?? [] };
}

// Probe with a real search term the scraper also uses ("yoga") — the bare
// /events/ pseudo-term returns 0 results even for valid city slugs.
// Eventbrite throttles bursts hard, so 429s get a long cool-down + retry.
async function ebProbe(slug) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`https://www.eventbrite.com/d/${slug}/yoga/`, {
      headers: { 'User-Agent': UA },
      redirect: 'follow',
    });
    if (res.status === 429) {
      await sleep(60000 + Math.random() * 15000);
      continue;
    }
    if (!res.ok) return { ok: false, status: res.status };
    const html = await res.text();
    const m = html.match(/window\.__SERVER_DATA__\s*=\s*(\{.*?\});\s*\n/s);
    if (!m) return { ok: false, status: 'no-server-data' };
    try {
      const data = JSON.parse(m[1]);
      const n = data?.search_data?.events?.results?.length ?? 0;
      return { ok: n > 0, status: `results=${n}` };
    } catch {
      return { ok: false, status: 'parse-fail' };
    }
  }
  return { ok: false, status: 'still-429' };
}

const mode = process.argv[2] ?? 'ra';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const [name, override, ebSlugs] of CANDIDATES) {
  if (mode === 'ra') {
    const term = override ?? name;
    const { areas, error } = await raArea(term);
    if (error) {
      console.log(`${name}\tRA-ERROR ${error}`);
    } else {
      const hits = areas.map((a) => `${a.id}:${a.name} (${a.country?.name})`).join(' | ') || '—';
      console.log(`${name}\t${hits}`);
    }
    await sleep(300);
  } else {
    for (const slug of ebSlugs) {
      const r = await ebProbe(slug);
      console.log(`${name}\t${slug}\t${r.ok ? 'OK' : 'FAIL'}\t${r.status}`);
      await sleep(9000 + Math.random() * 4000);
      if (r.ok) break;
    }
  }
}
