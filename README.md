# GROUK Sniper MVP

Semi-automatic sniper MVP:
- Watches WATCH_ENDPOINT for hot tokens (pump.fun / dexscreener)
- Posts alerts to Telegram
- Has /execute endpoint to manually trigger buy (executor)
- Auto-sell: if watcher detects large aggregated buys (BIG_BUY_USD_THRESHOLD) for the same token, it will auto-trigger sell of previously bought position

**DEFAULT**: DRY_RUN=true (no real txs). Test on devnet. Read README and follow checklist before mainnet.

See .env.example for env vars.
