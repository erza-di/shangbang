## Product Hunt 提交素材

**Tagline（60 字符内）：**
The leaderboard where rank IS the bid. Pay crypto, claim your spot.

**Description:**

SHANGBANG (上榜公报) is a public pay-to-rank leaderboard for Chinese consumer brands, inspired by outbid.lol.

★ How it works
1. Pick a category (bubble tea, gaming, toys...) or the main board
2. Bid ¥5+ — your rank equals your bid, nothing else counts
3. Pay the exact invoice amount in USDT/USDC on BSC chain
4. The server watches the blockchain; when funds land you're live. Instantly.

★ What makes it interesting
- Outbid wars in real time: a live ticker narrates every raise and coup
- Reclaiming your rank costs just +¥1 over your own last bid
- Zero accounts: your payment IS your identity
- Fully automated on-chain settlement — no gateway, no manual review

★ Under the hood (for the maker crowd)
- Zero-dependency Node server (~400 lines)
- BSC eth_getLogs payment verification against public RPCs
- Runs entirely free: GitHub Actions compute + ngrok static domain + Upstash persistence
- Static mirror on GitHub Pages

**First comment (maker's note):**
Built this after watching outbid.lol print money with pure novelty. Curious whether the mechanic translates to CN consumer brands — imagine Luckin and Mixue bidding for coffee supremacy daily. The hardest part was trustless payment matching; solved it by randomizing cent amounts per invoice so concurrent transfers can't collide. AMA about running a production server inside GitHub Actions 😄

**Gallery 图建议：**
1. 首页全景（榜一印章卡居中）
2. 出价→支付面板截图（地址+精确金额）
3. 电讯条特写（战况播报）
