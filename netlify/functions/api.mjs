import { getStore } from "@netlify/blobs";
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });
const clip = (s, n) => String(s ?? "").trim().slice(0, n);
const rid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);
const okCover = u => /^\/api\/cover\/[0-9a-f]{16}$/.test(u) || /^https:\/\/[^\s"'<>]{1,500}$/.test(u);
const list = async (store, prefix) => {
  const { blobs } = await store.list({ prefix });
  return (await Promise.all(blobs.map(b => store.get(b.key, { type: "json" })))).filter(Boolean);
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
  const body = ["POST", "PATCH"].includes(m) ? await req.json().catch(() => ({})) : {};

  if (p[0] === "login") return J({ ok: true, admin: isAdmin });
  if (p[0] === "data" && m === "GET") return J({ titles: await list(store, "t:"), reviews: await list(store, "r:") });

  if (p[0] === "title" && m === "POST") {
    const t = { id: rid(), name: clip(body.name, 90), type: ["serie", "pelicula", "libro", "comic", "musica"].includes(body.type) ? body.type : "serie",
      year: clip(body.year, 4), creator: clip(body.creator, 80), platform: clip(body.platform, 60), syn: clip(body.syn, 400),
      tags: (Array.isArray(body.tags) ? body.tags : []).slice(0, 12).map(x => clip(x, 30)), warns: (Array.isArray(body.warns) ? body.warns : []).slice(0, 8).map(x => clip(x, 30)),
      cover: okCover(body.cover) ? body.cover : "", ts: Date.now() };
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
