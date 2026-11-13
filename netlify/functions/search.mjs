const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });
const https = u => (u ? String(u).replace(/^http:/, "https:") : "");
const txt = h => String(h || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 260);
const gtag = s => { const o = []; [[/comed/i, "Comedia"], [/drama/i, "Drama"], [/fantas/i, "Fantasía"], [/romanc|romanti/i, "Romance"], [/histor|period/i, "Época"], [/teen|young adult|juvenil|shoujo|shojo/i, "Juvenil"]].forEach(([r, t]) => r.test(s) && o.push(t)); return o; };
const get = async u => { const r = await fetch(u, { headers: { "user-agent": "PinkPonyClub/1.0", accept: "application/json" } }); if (!r.ok) throw new Error(String(r.status)); return r.json(); };
const itunes = async (type, e) => {
  const d = await get(`https://itunes.apple.com/search?limit=8&country=ES&lang=es_es&${type === "pelicula" ? "media=movie" : "media=music&entity=album"}&term=${e}`);
  return d.results.map(s => ({ name: s.trackName || s.collectionName, year: (s.releaseDate || "").slice(0, 4), creator: s.artistName || "", platform: "", syn: txt(s.longDescription || s.shortDescription), cover: https((s.artworkUrl100 || "").replace("100x100bb", type === "pelicula" ? "400x600bb" : "600x600bb")), tags: gtag(s.primaryGenreName || "") }));
};
const manga = async e => {
  const d = await get(`https://api.jikan.moe/v4/manga?limit=6&q=${e}`);
  return (d.data || []).map(m => ({ name: m.title_english || m.title, year: String(m.published?.prop?.from?.year || ""), creator: (m.authors || []).map(a => a.name).join(" / "), platform: "", syn: txt(m.synopsis), cover: https(m.images?.jpg?.large_image_url || m.images?.jpg?.image_url), tags: gtag((m.genres || []).map(g => g.name).join(" ")) }));
};
const gbooks = async (e, extra) => {
  const d = await get(`https://www.googleapis.com/books/v1/volumes?maxResults=8&printType=books&q=${e}${extra}`);
  return (d.items || []).map(({ volumeInfo: v }) => ({ name: v.title, year: (v.publishedDate || "").slice(0, 4), creator: (v.authors || []).join(", "), platform: "", syn: txt(v.description), cover: https(v.imageLinks?.thumbnail || "").replace("zoom=1", "zoom=2"), tags: gtag((v.categories || []).join(" ")) }));
};
const olib = async e => {
  const d = await get(`https://openlibrary.org/search.json?limit=8&fields=title,author_name,first_publish_year,cover_i,subject&q=${e}`);
  return (d.docs || []).map(b => ({ name: b.title, year: String(b.first_publish_year || ""), creator: (b.author_name || []).slice(0, 2).join(", "), platform: "", syn: "", cover: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg` : "", tags: gtag((b.subject || []).slice(0, 8).join(" ")) }));
};
export default async (req) => {
  const club = (process.env.CLUB_CODE || "").trim(), adm = (process.env.ADMIN_CODE || "").trim();
  if (!club || !adm) return J({ error: "Faltan las variables CLUB_CODE y ADMIN_CODE" }, 500);
  if (req.headers.get("x-club-code") !== club && req.headers.get("x-admin-code") !== adm) return J({ error: "code" }, 401);
  const u = new URL(req.url), type = u.searchParams.get("type"), q = (u.searchParams.get("q") || "").slice(0, 100).trim();
  if (!q) return J([]);
  const e = encodeURIComponent(q);
  const src = type === "pelicula" || type === "musica" ? [itunes(type, e)]
    : type === "comic" ? [manga(e), gbooks(e, "+subject:comics"), olib(e)]
    : [gbooks(e, ""), olib(e)];
  const res = await Promise.allSettled(src);
  const seen = new Set(), out = [];
  const lists = res.filter(r => r.status === "fulfilled").map(r => r.value);
  for (let i = 0; i < 8; i++) for (const l of lists) { const x = l[i]; if (x && x.name && !seen.has(x.name.toLowerCase())) { seen.add(x.name.toLowerCase()); out.push(x); } }
  return J(out.slice(0, 12));
};
export const config = { path: "/buscar" };
