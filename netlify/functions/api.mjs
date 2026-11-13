import { getStore } from "@netlify/blobs";
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });
const clip = (s, n) => String(s ?? "").trim().slice(0, n);
const rid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);
const okCover = u => /^\/api\/cover\/[0-9a-f]{16}$/.test(u) || /^https:\/\/[^\s"'<>]{1,500}$/.test(u);
const list = async (store, prefix) => {
  const { blobs } = await store.list({ prefix });
  return (await Promise.all(blobs.map(b => store.get(b.key, { type: "json" })))).filter(Boolean);
};
const cleanTitle = (body, id, ts) => ({
  id, name: clip(body.name, 90), type: ["serie", "pelicula", "libro", "comic", "musica"].includes(body.type) ? body.type : "serie",
  year: clip(body.year, 4), creator: clip(body.creator, 80), platform: clip(body.platform, 60), syn: clip(body.syn, 500),
  tags: (Array.isArray(body.tags) ? body.tags : []).slice(0, 14).map(x => clip(x, 30)), warns: (Array.isArray(body.warns) ? body.warns : []).slice(0, 8).map(x => clip(x, 30)),
  cover: okCover(body.cover) ? body.cover : "", ts });

/* ---------- Búsqueda de portadas y datos ---------- */
const https = u => (u ? String(u).replace(/^http:/, "https:") : "");
const txt = h => { let s = String(h || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 420); if (s.length >= 420) { const i = s.lastIndexOf(". "); if (i > 150) s = s.slice(0, i + 1); } return s; };
const gtag = s => { const o = []; [[/comed/i, "Comedia"], [/drama/i, "Drama"], [/fantas/i, "Fantasía"], [/romanc|romanti/i, "Romance"], [/histor|period/i, "Época"], [/teen|young adult|juvenil|shoujo|shojo/i, "Juvenil"], [/horror|terror/i, "Terror"], [/thriller|suspens/i, "Thriller"], [/myster|miste/i, "Misterio"], [/crime|crimen|detective/i, "Crimen"], [/action|acci[oó]n/i, "Acción"], [/adventure|aventura/i, "Aventura"], [/sci-?fi|science fiction|ciencia ficci/i, "Ciencia ficción"], [/animat|animaci/i, "Animación"], [/documentar/i, "Documental"], [/musical/i, "Musical"], [/supernat|paranormal/i, "Sobrenatural"], [/vampir/i, "Vampiras"], [/western/i, "Western"], [/biograph|biogr[aá]f/i, "Biográfica"], [/\bwar\b|guerra/i, "Guerra"], [/superhero|superh[eé]roe/i, "Superhéroes"], [/dystop|distop/i, "Distopía"], [/slice of life/i, "Slice of life"]].forEach(([r, t]) => r.test(s) && o.push(t)); return o; };
const mtag = s => { const o = []; [[/pop/i, "Pop"], [/rock|punk|metal/i, "Rock"], [/indie|alternativ/i, "Indie"], [/folk|country|singer/i, "Folk"], [/dance|electr|house|club/i, "Para bailar"]].forEach(([r, t]) => r.test(s) && o.push(t)); return o; };
const get = async (u, h = {}) => { const r = await fetch(u, { headers: { "user-agent": "PinkPonyClub/1.0", accept: "application/json", ...h } }); if (!r.ok) throw new Error(String(r.status)); return r.json(); };
const TK = (process.env.TMDB_KEY || "").trim();
const tm = async (path, params = "", lang = "es-ES") => {
  const bearer = TK.length > 40;
  const url = `https://api.themoviedb.org/3/${path}${path.includes("?") ? "&" : "?"}language=${lang}${params}${bearer ? "" : "&api_key=" + TK}`;
  return get(url, bearer ? { Authorization: "Bearer " + TK } : {});
};
const GEN = { 28: "Acción", 10759: "Acción", 12: "Aventura", 16: "Animación", 35: "Comedia", 80: "Crimen", 99: "Documental", 18: "Drama", 14: "Fantasía", 10765: "Fantasía", 36: "Época", 27: "Terror", 9648: "Misterio", 10749: "Romance", 878: "Ciencia ficción", 53: "Thriller", 10752: "Guerra", 10768: "Guerra", 37: "Western", 10402: "Musical" };
const tmdb = async (type, q) => {
  const kind = type === "serie" ? "tv" : "movie";
  const d = await tm(`search/${kind}?query=${encodeURIComponent(q)}&include_adult=false`);
  return Promise.all((d.results || []).slice(0, 6).map(async x => {
    let det = {}, syn = x.overview || "";
    try { det = await tm(`${kind}/${x.id}`, kind === "movie" ? "&append_to_response=credits" : ""); syn = syn || det.overview || ""; } catch (e) {}
    if (!syn) { try { syn = (await tm(`${kind}/${x.id}`, "", "en-US")).overview || ""; } catch (e) {} }
    const who = kind === "movie" ? (det.credits?.crew || []).filter(c => c.job === "Director").map(c => c.name) : (det.created_by || []).map(c => c.name);
    const gids = (x.genre_ids || []).concat((det.genres || []).map(g => g.id));
    return { name: x.title || x.name, year: (x.release_date || x.first_air_date || "").slice(0, 4), creator: who.slice(0, 2).join(", "), platform: kind === "tv" ? (det.networks || [])[0]?.name || "" : "", syn: txt(syn), cover: x.poster_path ? "https://image.tmdb.org/t/p/w500" + x.poster_path : "", tags: [...new Set(gids.map(g => GEN[g]).filter(Boolean))] };
  }));
};
const tvmaze = async e => (await get("https://api.tvmaze.com/search/shows?q=" + e)).slice(0, 8).map(({ show: s }) => ({ name: s.name, year: (s.premiered || "").slice(0, 4), creator: "", platform: s.network?.name || s.webChannel?.name || "", syn: txt(s.summary), cover: https(s.image?.original || s.image?.medium), tags: gtag((s.genres || []).join(" ")) }));
const itunes = async (type, e) => {
  const d = await get(`https://itunes.apple.com/search?limit=8&country=ES&${type === "pelicula" ? "media=movie" : "media=music&entity=album"}&term=${e}`);
  return d.results.map(s => ({ name: s.trackName || s.collectionName, year: (s.releaseDate || "").slice(0, 4), creator: s.artistName || "", platform: "", syn: txt(s.longDescription || s.shortDescription), cover: https((s.artworkUrl100 || "").replace("100x100bb", type === "pelicula" ? "400x600bb" : "600x600bb")), tags: type === "musica" ? mtag(s.primaryGenreName || "") : gtag(s.primaryGenreName || "") }));
};
const manga = async e => (await get(`https://api.jikan.moe/v4/manga?limit=6&q=${e}`)).data.map(m => ({ name: m.title_english || m.title, year: String(m.published?.prop?.from?.year || ""), creator: (m.authors || []).map(a => a.name).join(" / "), platform: "", syn: txt(m.synopsis), cover: https(m.images?.jpg?.large_image_url || m.images?.jpg?.image_url), tags: gtag((m.genres || []).map(g => g.name).join(" ")) }));
const gbooks = async (e, extra) => ((await get(`https://www.googleapis.com/books/v1/volumes?maxResults=8&printType=books&q=${e}${extra}`)).items || []).map(({ volumeInfo: v }) => ({ name: v.title, year: (v.publishedDate || "").slice(0, 4), creator: (v.authors || []).join(", "), platform: "", syn: txt(v.description), cover: https(v.imageLinks?.thumbnail || "").replace("zoom=1", "zoom=2"), tags: gtag((v.categories || []).join(" ")) }));
const olib = async e => ((await get(`https://openlibrary.org/search.json?limit=8&fields=title,author_name,first_publish_year,cover_i,subject&q=${e}`)).docs || []).map(b => ({ name: b.title, year: String(b.first_publish_year || ""), creator: (b.author_name || []).slice(0, 2).join(", "), platform: "", syn: "", cover: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg` : "", tags: gtag((b.subject || []).slice(0, 8).join(" ")) }));
const search = async (type, q) => {
  const e = encodeURIComponent(q);
  const src = type === "serie" ? (TK ? [tmdb(type, q), tvmaze(e)] : [tvmaze(e)])
    : type === "pelicula" ? (TK ? [tmdb(type, q), itunes(type, e)] : [itunes(type, e)])
    : type === "musica" ? [itunes(type, e)]
    : type === "comic" ? [manga(e), gbooks(e, "+subject:comics"), olib(e)]
    : [gbooks(e, ""), olib(e)];
  const lists = (await Promise.allSettled(src)).filter(r => r.status === "fulfilled").map(r => r.value);
  const seen = new Set(), out = [];
  for (let i = 0; i < 8; i++) for (const l of lists) { const x = l[i]; if (x && x.name && !seen.has(x.name.toLowerCase())) { seen.add(x.name.toLowerCase()); out.push(x); } }
  return out.slice(0, 12);
};

export default async (req) => {
  const p = new URL(req.url).pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean), m = req.method;
  const store = getStore("ppc");
  if (p[0] === "cover" && m === "GET") {
    const b = await store.get("cover:" + clip(p[1], 20), { type: "arrayBuffer" });
    return b ? new Response(b, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=31536000, immutable" } }) : new Response("", { status: 404 });
  }
  const club = (process.env.CLUB_CODE || "").trim(), adm = (process.env.ADMIN_CODE || "").trim();
  if (!club || !adm) return J({ error: "Faltan las variables CLUB_CODE y ADMIN_CODE en Netlify" }, 500);
  const isAdmin = req.headers.get("x-admin-code") === adm;
  if (req.headers.get("x-club-code") !== club && !isAdmin) return J({ error: "code" }, 401);
  const body = ["POST", "PATCH", "PUT"].includes(m) ? await req.json().catch(() => ({})) : {};

  if (p[0] === "login") return J({ ok: true, admin: isAdmin });
  if (p[0] === "data" && m === "GET") return J({ titles: await list(store, "t:"), reviews: await list(store, "r:") });
  if (p[0] === "search" && m === "GET") {
    const u = new URL(req.url), q = clip(u.searchParams.get("q"), 100);
    return J(q ? await search(u.searchParams.get("type"), q) : []);
  }
  if (p[0] === "title" && m === "POST") {
    const t = cleanTitle(body, rid(), Date.now());
    if (!t.name) return J({ error: "Falta el título" }, 400);
    await store.setJSON("t:" + t.id, t);
    return J(t);
  }
  if (p[0] === "title" && m === "PUT") {
    if (!isAdmin) return J({ error: "admin" }, 403);
    const old = await store.get("t:" + clip(p[1], 20), { type: "json" });
    if (!old) return J({ error: "no existe" }, 404);
    const t = cleanTitle(body, old.id, old.ts);
    if (!t.name) return J({ error: "Falta el título" }, 400);
    await store.setJSON("t:" + t.id, t);
    return J(t);
  }
  if (p[0] === "title" && m === "PATCH") {
    const t = await store.get("t:" + clip(p[1], 20), { type: "json" });
    if (!t) return J({ error: "no existe" }, 404);
    if ((!t.cover || isAdmin) && okCover(body.cover)) t.cover = body.cover;
    await store.setJSON("t:" + t.id, t);
    return J(t);
  }
  if (p[0] === "title" && m === "DELETE") {
    if (!isAdmin) return J({ error: "admin" }, 403);
    const id = clip(p[1], 20);
    for (const r of await list(store, "r:")) if (r.titleId === id) await store.delete("r:" + r.id);
    await store.delete("t:" + id);
    return J({ ok: true });
  }
  if (p[0] === "review" && m === "POST") {
    const rating = Math.round(Number(body.rating));
    if (!(rating >= 1 && rating <= 5) || !clip(body.text, 280)) return J({ error: "Reseña inválida" }, 400);
    const t = await store.get("t:" + clip(body.titleId, 20), { type: "json" });
    if (!t) return J({ error: "no existe" }, 404);
    const r = { id: rid(), titleId: t.id, rating, text: clip(body.text, 280), spoiler: !!body.spoiler, author: clip(body.author, 30), ts: Date.now() };
    await store.setJSON("r:" + r.id, r);
    return J(r);
  }
  if (p[0] === "review" && m === "DELETE") {
    if (!isAdmin) return J({ error: "admin" }, 403);
    await store.delete("r:" + clip(p[1], 20));
    return J({ ok: true });
  }
  if (p[0] === "cover" && m === "POST") {
    const b64 = String(body.data || "").split(",")[1] || "";
    if (b64.length > 600000) return J({ error: "Imagen muy grande" }, 413);
    const id = rid();
    await store.set("cover:" + id, Buffer.from(b64, "base64"));
    return J({ url: "/api/cover/" + id });
  }
  return J({ error: "not found" }, 404);
};
export const config = { path: "/api/*" };
