## Reddit r/SideProject / r/InternetIsBeautiful

**Title options (pick one):**
- I made a leaderboard where your rank literally IS your bid — Luckin Coffee vs Pop Mart edition
- outbid.lol but for Chinese brands: pay crypto, claim rank, get outbid tomorrow
- The most honest ranking system ever: no SEO, no votes, just money [demo]

**Body:**

Stole the concept from outbid.lol (the "rank is the bid" site that went viral) and rebuilt it around Chinese consumer brands as a weekend project.

Rules are brutally simple:
- Bid ¥5+ to get on the board. Rank = bid amount. That's the whole system.
- Got outbid? Add ¥1 over your own previous bid to reclaim your spot.
- Payment is USDT on BSC → the server watches the blockchain and auto-lists you when your exact invoice amount lands. No signup.

What I actually built:
- Zero-dependency Node backend, ~400 lines
- On-chain payment verification via public BSC RPC eth_getLogs (randomized cents in each invoice so concurrent payments never collide)
- Whole thing runs inside GitHub Actions for free, data survives instance rotation via Upstash Redis
- Static mirror on GitHub Pages

Live: https://erza-di.github.io/shangbang/

Seed entries are fictional demo data; your bids are real bids (well, real demo bids — feel free to test the flow, it's fun watching the ticker narrate the drama).

Roast my design or the idea, I can take it.

---

## r/CryptoCurrency 角度（如果发这个版，换个钩子）

**Title:** I built a tiny real-world use case for USDT payments: pay-to-rank billboard that verifies BSC transfers and auto-lists you

**Body:** No payment gateway, no KYC middleware — just eth_getLogs watching a wallet address, matching randomized invoice amounts, and publishing your listing when funds land. Full flow takes ~30 seconds from transfer to live listing. Code + live demo inside: <link>
