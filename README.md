# 🇪🇸 Spain 2026 — Squad Tracker

A single-file trip dashboard for the 6 of us (pd, kukkik, muzzy, peem, vic, phoom).
Follows the planning note: Wanderlog + Tricount links, flights, coaches, accommodation,
and a **shared, editable task matrix** (tap a cell → it syncs for everyone).

- **Front-end:** `index.html` (host free on GitHub Pages)
- **Shared state:** Supabase (free tier, no server) — so everyone can edit the same checklist
- **Live itinerary:** pulled from your Wanderlog plan automatically (`worker.js`, free Cloudflare Worker)

---

## Part A — Make the checklist shared (Supabase, ~5 min, one-time)

1. Go to **https://supabase.com** → sign in → **New project**. Pick any name + password, free plan.
2. When it's ready, open the left sidebar → **SQL Editor** → **New query**, paste this and click **Run**:

   ```sql
   create table trip_state (
     key text primary key,
     value text,
     updated_at timestamptz default now()
   );

   alter table trip_state enable row level security;
   create policy "read"   on trip_state for select using (true);
   create policy "insert" on trip_state for insert with check (true);
   create policy "update" on trip_state for update using (true);

   -- pre-tick the flights pd, kukkik & muzzy already booked
   insert into trip_state (key, value) values
     ('check:flight depart::pd','1'),
     ('check:flight depart::kukkik','1'),
     ('check:flight depart::muzzy','1'),
     ('check:flight return::pd','1'),
     ('check:flight return::kukkik','1'),
     ('check:flight return::muzzy','1');
   ```

3. Turn on live sync: sidebar → **Database → Replication** (or **Realtime**) → enable replication for the
   **`trip_state`** table. *(Optional — the page also auto-refreshes every 6s as a fallback.)*
4. Get your keys: sidebar → **Project Settings → API**. Copy:
   - **Project URL** (e.g. `https://abcdxyz.supabase.co`)
   - **anon / public** key (the long one — safe to put in a public page)
5. Open `index.html`, and at the very top of the `<script>` paste them in:

   ```js
   const SUPABASE_URL = "https://abcdxyz.supabase.co";
   const SUPABASE_ANON_KEY = "eyJhbGciOi....";   // the anon public key
   ```

That's it — now every tick is shared with all 6.

> **Privacy:** anyone with the link can edit (no logins). That's the point for a 6-person group,
> and the anon key is designed to be public. Don't put secrets in the accommodation fields.

---

## Part B — Put it online (GitHub Pages, free permanent link)

1. Create a public GitHub repo, e.g. **`spain-trip`**.
2. Upload `index.html` (drag-drop on github.com, or git below).
3. Repo → **Settings → Pages** → Source **Deploy from a branch** → **main** → **/ (root)** → Save.
4. ~1 min later your link is **`https://<username>.github.io/spain-trip/`** — drop it in the group chat. 🎉

### Via command line
```bash
cd spain-trip
git init && git add . && git commit -m "Spain 2026 tracker"
git branch -M main
git remote add origin https://github.com/<username>/spain-trip.git
git push -u origin main
```
Update later: edit `index.html`, then `git commit -am "update" && git push`.

**No-account alternative:** drag `index.html` onto **https://app.netlify.com/drop** for an instant link.

---

## Part C — Reliable live itinerary (Cloudflare Worker, ~5 min)

The itinerary section pulls **live from your Wanderlog plan every time the page opens**, so editing the
plan in Wanderlog updates the site automatically — no copy-paste.

**It already works without this step**, using free public proxies as a best-effort fallback (and a baked-in
snapshot of the current plan so it's never blank). But those public proxies are flaky and rate-limited, so
for *reliable* live sync, deploy your own tiny proxy — it's free and takes a few minutes:

1. Sign up at **https://workers.cloudflare.com** (free plan).
2. **Create application → Create Worker** → give it a name like `spain-itin` → **Deploy**.
3. Click **Edit code**, delete the sample, paste the entire contents of **`worker.js`**, then **Deploy**.
   *(If your Wanderlog share link ever changes, update `WANDERLOG_URL` at the top of `worker.js`.)*
4. Copy the Worker URL (looks like `https://spain-itin.<your-subdomain>.workers.dev`).
5. In `index.html`, set:
   ```js
   const ITINERARY_ENDPOINT = "https://spain-itin.<your-subdomain>.workers.dev";
   ```

Now every page open fetches the current itinerary through your Worker — fast, reliable, and always live.
The little dot next to **🗺️ Itinerary** shows green ("Synced live") or amber ("showing last saved plan").

> The Worker only *reads* your public shared plan and returns it as JSON — no keys, no write access.

---

## Editing the trip data
All in the `TRIP DATA` block near the top of the `<script>` in `index.html`:
- `PEOPLE` — the 6 names (also the matrix columns)
- `TASKS` — matrix rows
- `ACCOM` — cities + nights
- `TRIP_START` — drives the countdown

Flights, coaches and links are plain HTML higher up — edit the text directly.
