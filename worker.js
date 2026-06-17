/* =====================================================================
   Spain Trip — Wanderlog itinerary proxy (Cloudflare Worker)
   ---------------------------------------------------------------------
   Fetches your Wanderlog shared plan server-side (no CORS limits),
   pulls the embedded itinerary data, and returns clean JSON to the site.
   Deploy free at https://workers.cloudflare.com — see README "Part C".
   ===================================================================== */

const WANDERLOG_URL = "https://wanderlog.com/plan/lbgeydjlwhpzhqic/trip-to-spain/shared";

export default {
  async fetch(request) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Cache-Control": "public, max-age=60", // light cache; refreshes ~every minute
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    try {
      const res = await fetch(WANDERLOG_URL, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SpainTripBot/1.0)" },
        cf: { cacheTtl: 60, cacheEverything: true },
      });
      const html = await res.text();
      const data = parseWanderlog(html);
      return new Response(JSON.stringify(data), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
  },
};

function parseWanderlog(html) {
  const marker = "window.__MOBX_STATE__";
  let i = html.indexOf(marker);
  if (i < 0) throw new Error("trip data not found in page");
  i = html.indexOf("{", i);
  let depth = 0, inStr = false, esc = false;
  const start = i;
  for (; i < html.length; i++) {
    const c = html[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; }
    else { if (c === '"') inStr = true; else if (c === "{") depth++; else if (c === "}") { depth--; if (depth === 0) { i++; break; } } }
  }
  const o = JSON.parse(html.slice(start, i));
  const tp = o.tripPlanStore.data.tripPlan;

  const dtext = (v) => {
    if (v == null) return "";
    if (typeof v === "string") {
      try { const d = JSON.parse(v); if (d && d.ops) return d.ops.map((x) => (typeof x.insert === "string" ? x.insert : "")).join("").trim(); } catch (e) {}
      return v.trim();
    }
    if (v.ops) return v.ops.map((x) => (typeof x.insert === "string" ? x.insert : "")).join("").trim();
    if (v.text) return dtext(v.text);
    return "";
  };
  const pname = (b) => { const p = b.place || b; return (p && (p.name || p.customName)) || null; };

  const days = [], overview = [];
  for (const s of tp.itinerary.sections || []) {
    const heading = dtext(s.heading), items = [];
    for (const b of s.blocks || []) {
      if (b.place) items.push({ kind: "place", name: pname(b), time: [b.startTime, b.endTime].filter(Boolean).join(" – "), note: dtext(b.text) });
      else if (b.items) items.push({ kind: "check", name: dtext(b.title) || "checklist", sub: (b.items || []).map((it) => dtext(it.text || it.name)).filter(Boolean) });
      else { const t = dtext(b.text); if (t) items.push({ kind: "note", name: t }); }
    }
    if (s.date) days.push({ date: s.date, heading, items });
    else if (heading && items.length) overview.push({ heading, items });
  }
  return { title: tp.title, startDate: tp.startDate, endDate: tp.endDate, days, overview, syncedAt: new Date().toISOString() };
}
