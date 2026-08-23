## Show HN: I built a pay-to-rank leaderboard for China's consumer brands (inspired by outbid.lol)

Hi HN! I built 上榜公报 (SHANGBANG) — a public leaderboard where the rank IS the bid. Nothing else counts.

How it works:
- Anyone can list a site/product by bidding. ¥5 minimum, whole yuan only.
- Your rank = your bid. Want to move up? Pay more. Anyone can outbid you at any time — that's the game.
- Re-bidding on the same listing only requires +¥1 over your own last bid (you're raising, not rebuying).
- Payments settle in USDT/USDC on BSC. The backend watches the chain; once your transfer lands at the exact invoice amount (randomized cents prevent collisions), your listing goes live automatically. No accounts, no manual review.

Stack notes (all free-tier, $0/mo):
- Zero-dependency Node HTTP server (~400 lines), file persistence
- Cross-instance persistence via Upstash Redis
- Runs 24/7 on GitHub Actions with ngrok static domain; static mirror on GitHub Pages
- Chain scanning is plain JSON-RPC eth_getLogs against public BSC endpoints

The interesting design question: outbid.lol proved pay-to-rank works as a novelty for global indie products. I wanted to see what it looks like applied to Chinese consumer brands — Luckin vs Mixue bidding for coffee supremacy, Pop Mart defending #1 against the whole board.

It's live here: https://erza-di.github.io/shangbang/

Demo mode note: seed listings are fictional demo data. Real user bids are real bids.

Happy to answer anything about the chain-scan payment flow or running a server entirely inside GitHub Actions.
