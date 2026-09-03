# HoldCheck — v0 live

**Scope of this version:** CSV upload → computed tickets. No login, no broker
OAuth, no database. This is the fastest path to something you can point people
at — broker OAuth (Kite Connect has a paid developer tier, Dhan/Upstox have
their own approval flows) is a separate, slower workstream. See `SPEC.md` in
the full-build package for the eventual broker-connected architecture.

```
holdcheck-live/
  services/pricing/     Python FastAPI — the math (fee engine, Black-76, solver, state machine)
  web/                  Next.js — landing page (/) + CSV upload tool (/app)
  docker-compose.yml    local dev, both services together
```

## Go live today — fastest path

You need two deploys: the pricing API (a real server, not serverless — it has
to stay running) and the web app (static/serverless, Vercel is built for this).

**1. Deploy the pricing API first — Railway:**
```bash
cd services/pricing
npm install -g @railway/cli   # if you don't have it
railway login                 # opens a browser, sign up is free
railway init                  # creates a new Railway project
railway up                    # builds the Dockerfile and deploys
railway domain                # generates a public URL — copy it
```
That URL (e.g. `https://holdcheck-pricing-production.up.railway.app`) is your
`NEXT_PUBLIC_API_URL`. Test it: `curl https://<that-url>/health`.

**2. Deploy the web app — Vercel:**
```bash
cd ../../web
npm install -g vercel   # if you don't have it
vercel login
vercel --prod
```
When Vercel asks about environment variables (or in the dashboard afterward,
under Settings → Environment Variables), set:
```
NEXT_PUBLIC_API_URL = https://<your-railway-url-from-step-1>
```
Redeploy once (`vercel --prod` again) after setting it, since the value gets
baked in at build time.

**3. Lock down CORS** in `services/pricing/api.py` — change
`allow_origins=["*"]` to your actual Vercel URL — then `railway up` again.

That's it — you have a live URL for the landing page and the tool within
about 15 minutes, assuming both CLIs are already installed. Both platforms
have generous free tiers that comfortably cover a v0 launch.

## Run it locally

**Option A — Docker (simplest):**
```bash
docker compose up --build
```
Web: http://localhost:3000 · API: http://localhost:8000

**Option B — directly:**
```bash
# terminal 1
cd services/pricing
pip install -r requirements.txt
uvicorn api:app --reload --port 8000

# terminal 2
cd web
npm install
npm run dev
```

Test the API alone with the sample CSV:
```bash
curl -X POST http://localhost:8000/tickets/csv -F "file=@sample_positions.csv"
```

## CSV format

Columns (header row required): `underlying, expiry, strike, option_type, lot_size,
side, lots, entry_price, ltp, bid, ask, iv_atm, atm_ce_premium, atm_pe_premium,
forward, target_net, max_loss`

- `option_type`: `CE` or `PE`. `side`: `LONG` or `SHORT`.
- `expiry`: `YYYY-MM-DD`.
- `target_net` (long positions) and `max_loss` (short positions) are optional —
  leave blank and HoldCheck infers a 50%-premium placeholder target, flagged
  "no plan" in the UI.
- `bid`/`ask` optional — if missing, falls back to `ltp` and flags low confidence.
- Hit `GET /csv-template` on the running API for the exact column list + an
  example row.

You'll need to fill `iv_atm`, `atm_ce_premium`, `atm_pe_premium`, and `forward`
yourself for now (from your broker's option chain / GoCharting) — wiring these
to a live quote feed is the next milestone once a broker adapter is built.

## Deploy

**Web (Vercel):**
```bash
cd web
vercel deploy --prod
```
Set the environment variable `NEXT_PUBLIC_API_URL` in the Vercel project
settings to your deployed pricing service URL (see below) before the first
deploy, or the app will point at localhost.

**Pricing API (Railway or Fly.io — needs to stay running, not serverless):**

Railway:
```bash
cd services/pricing
railway init
railway up
```
Fly.io:
```bash
cd services/pricing
fly launch    # picks up the Dockerfile automatically
fly deploy
```
Either way, note the public URL Railway/Fly gives you and put it into the
web app's `NEXT_PUBLIC_API_URL`.

**Before you make this public:**
- Lock down CORS in `services/pricing/api.py` (`allow_origins=["*"]` right now)
  to your actual deployed frontend origin.
- All `DEFAULT_*` charge rates (STT, stamp duty, brokerage, exchange/SEBI fees)
  in `fee_engine.py` are placeholders — verify against a current NSE/SEBI
  circular and a real contract note before anyone trusts a number this shows.
- The disclaimer footer ("estimates only, not investment or tax advice") is
  already in the UI — keep it there, and don't add copy that reads as a
  recommendation (no "book profits" / "hold" / "exit now").
