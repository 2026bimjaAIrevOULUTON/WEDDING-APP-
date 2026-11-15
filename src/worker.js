import { DEFAULT_WEDDING } from "./wedding.js";

const REMIND_MINUTES = 30;
const IST = "+05:30";
const ms = (s) => new Date(s + ":00" + IST).getTime();
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/* ---------- database ---------- */
let schemaReady = false;
async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS subs (endpoint TEXT PRIMARY KEY, created INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS alerts (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, at INTEGER NOT NULL, dedupe TEXT UNIQUE)")
  ]);
  schemaReady = true;
}
async function getConfig(db, key) {
  const row = await db.prepare("SELECT value FROM config WHERE key = ?").bind(key).first();
  return row ? JSON.parse(row.value) : null;
}
async function setConfig(db, key, value) {
  await db.prepare("INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(key, JSON.stringify(value)).run();
}
async function getWedding(db) {
  const saved = await getConfig(db, "wedding");
  const w = structuredClone(DEFAULT_WEDDING);
  if (saved) {
    if (typeof saved.timesConfirmed === "boolean") w.timesConfirmed = saved.timesConfirmed;
    if (typeof saved.mapsUrl === "string") w.venue.mapsUrl = saved.mapsUrl;
    for (const e of w.events) if (saved.events && saved.events[e.id]) Object.assign(e, saved.events[e.id]);
  }
  w.events.sort((a, b) => ms(a.start) - ms(b.start));
  return w;
}

/* ---------- web push (VAPID, no payload: the phone fetches the text from /api/latest) ---------- */
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64uText = (s) => b64u(new TextEncoder().encode(s));
async function getVapid(db) {
  let v = await getConfig(db, "vapid");
  if (v) return v;
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  v = {
    publicKey: b64u(await crypto.subtle.exportKey("raw", pair.publicKey)),
    privateJwk: await crypto.subtle.exportKey("jwk", pair.privateKey)
  };
  // Keep the first key if two requests raced.
  await db.prepare("INSERT OR IGNORE INTO config (key, value) VALUES ('vapid', ?)").bind(JSON.stringify(v)).run();
  return getConfig(db, "vapid");
}
async function vapidHeader(vapid, endpoint, subject) {
  const head = b64uText(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = b64uText(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: subject
  }));
  const key = await crypto.subtle.importKey("jwk", vapid.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(head + "." + claims));
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${vapid.publicKey}`;
}
async function pushAll(db) {
  const { results } = await db.prepare("SELECT endpoint FROM subs").all();
  if (!results.length) return { sent: 0, failed: 0 };
  const vapid = await getVapid(db);
  const subject = (await getConfig(db, "origin")) || "https://example.com";
  let sent = 0, failed = 0;
  await Promise.all(results.map(async ({ endpoint }) => {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { TTL: "3600", Urgency: "high", "Content-Length": "0", Authorization: await vapidHeader(vapid, endpoint, subject) }
      });
      if (res.status === 404 || res.status === 410) await db.prepare("DELETE FROM subs WHERE endpoint = ?").bind(endpoint).run();
      if (res.ok) sent++; else failed++;
    } catch { failed++; }
  }));
  return { sent, failed };
}
async function addAlert(db, kind, title, body, dedupe = null) {
  const r = await db.prepare("INSERT OR IGNORE INTO alerts (kind, title, body, at, dedupe) VALUES (?, ?, ?, ?, ?)")
    .bind(kind, title, body, Date.now(), dedupe).run();
  return r.meta.changes > 0;
}

/* ---------- host passcode ---------- */
async function hashPass(pass, salt) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + pass));
  return b64u(d);
}
async function isHost(db, request) {
  const host = await getConfig(db, "host");
  const pass = request.headers.get("x-host-passcode") || "";
  return !!host && !!pass && (await hashPass(pass, host.salt)) === host.hash;
}

/* ---------- validation ---------- */
const DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
function cleanEvents(input) {
  const out = {};
  for (const e of DEFAULT_WEDDING.events) {
    const x = input && input[e.id];
    if (!x) continue;
    if (!DT.test(x.start) || !DT.test(x.end) || !(ms(x.end) > ms(x.start))) throw new Error(`Check the times for ${e.name}: the end must be after the start.`);
    const spot = String(x.spot || "").trim().slice(0, 120);
    out[e.id] = { start: x.start, end: x.end, spot: spot || e.spot };
  }
  return out;
}

/* ---------- API ---------- */
async function api(request, env, url) {
  const db = env.DB;
  await ensureSchema(db);
  const path = url.pathname, method = request.method;

  if (path === "/api/state" && method === "GET") {
    if (!(await getConfig(db, "origin"))) await setConfig(db, "origin", url.origin);
    const [wedding, vapid, host, ann] = await Promise.all([
      getWedding(db), getVapid(db), getConfig(db, "host"),
      db.prepare("SELECT id, body, at FROM alerts WHERE kind = 'announce' ORDER BY id DESC LIMIT 20").all()
    ]);
    return json({ wedding, announcements: ann.results, vapidPublicKey: vapid.publicKey, hostClaimed: !!host, now: Date.now() });
  }

  if (path === "/api/latest" && method === "GET") {
    const a = await db.prepare("SELECT title, body, at FROM alerts ORDER BY id DESC LIMIT 1").first();
    return json(a || { title: "Wedding update", body: "Open the guide for the latest.", at: Date.now() });
  }

  if (method !== "POST") return json({ error: "Not found" }, 404);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Bad request" }, 400); }

  if (path === "/api/subscribe") {
    const endpoint = body && body.endpoint;
    if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 1000) return json({ error: "Bad subscription" }, 400);
    await db.prepare("INSERT OR IGNORE INTO subs (endpoint, created) VALUES (?, ?)").bind(endpoint, Date.now()).run();
    return json({ ok: true });
  }

  if (path === "/api/host/claim") {
    const pass = String((body && body.passcode) || "");
    if (pass.length < 6) return json({ error: "Use at least 6 characters." }, 400);
    const salt = b64u(crypto.getRandomValues(new Uint8Array(16)));
    const r = await db.prepare("INSERT OR IGNORE INTO config (key, value) VALUES ('host', ?)")
      .bind(JSON.stringify({ salt, hash: await hashPass(pass, salt) })).run();
    if (!r.meta.changes) return json({ error: "A host passcode is already set." }, 409);
    return json({ ok: true });
  }

  if (path.startsWith("/api/host/")) {
    if (!(await isHost(db, request))) return json({ error: "Wrong passcode." }, 401);

    if (path === "/api/host/check") return json({ ok: true });

    if (path === "/api/host/schedule") {
      let events;
      try { events = cleanEvents(body.events); } catch (e) { return json({ error: e.message }, 400); }
      const mapsUrl = String(body.mapsUrl || "").trim();
      if (mapsUrl && !/^https:\/\/\S+$/.test(mapsUrl)) return json({ error: "The map link must start with https://" }, 400);
      await setConfig(db, "wedding", { events, timesConfirmed: !!body.timesConfirmed, mapsUrl: mapsUrl.slice(0, 500) });
      return json({ ok: true, wedding: await getWedding(db) });
    }

    if (path === "/api/host/announce") {
      const text = String(body.text || "").trim().slice(0, 300);
      if (!text) return json({ error: "Write a message first." }, 400);
      await addAlert(db, "announce", "Update from the family", text);
      return json({ ok: true, push: await pushAll(db) });
    }

    if (path === "/api/host/clear") {
      await db.prepare("DELETE FROM alerts WHERE kind = 'announce'").run();
      return json({ ok: true });
    }
  }
  return json({ error: "Not found" }, 404);
}

/* ---------- reminders: runs every minute ---------- */
async function remind(env) {
  const db = env.DB;
  await ensureSchema(db);
  const w = await getWedding(db), now = Date.now();
  for (const e of w.events) {
    const start = ms(e.start), lead = start - now;
    if (lead > 0 && lead <= REMIND_MINUTES * 60000) {
      const mins = Math.max(1, Math.round(lead / 60000));
      const fresh = await addAlert(db, "reminder", `${e.name} starts in ${mins} min`, `${e.spot} · Wear: ${e.dress}`, `rem:${e.id}:${e.start}`);
      if (fresh) await pushAll(db);
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try { return await api(request, env, url); }
      catch (e) { console.error(e); return json({ error: "Something went wrong. Please try again." }, 500); }
    }
    return env.ASSETS.fetch(request);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(remind(env));
  }
};
