# XRP Cafe API Reference

Verified 2026-10-27 against `api.xrp.cafe` (live tests, HTTP 200, ~200ms).

## Access notes

- Base host: `https://api.xrp.cafe` — **open, no API key required**, CORS `access-control-allow-origin: *`.
- No Cloudflare challenge on the API host (the main `xrp.cafe` site is behind Turnstile, but the API is not).
- Avg response time ~200ms. `fullAmount=true` returns the whole collection in one ~30KB payload instead of paginating in chunks of 20.

## Endpoint A — Collection properties / rarity

```
GET https://api.xrp.cafe/collection/properties?vanity=<collection_vanity>
```

Example: `https://api.xrp.cafe/collection/properties?vanity=ripplerogues`

Returns collection-level traits and a rarity breakdown, e.g. for Ripple Rogues:

| Rarity   | Share  |
|----------|--------|
| Common   | 38.72% |
| Uncommon | 29.32% |
| Rare     | 15.79% |
| Legendary| 11.28% |
| Mythic   | 4.89%  |

Also includes trait categories: Accessory, Background, Body type, Character type, Eyewear, Headwear.

## Endpoint B — Full collection NFT list with owners

```
GET https://api.xrp.cafe/api/collection/<collection_vanity>/nfts?pageNumber=0&sort=low&forSaleItemType=&rarities=%5B%5D&fullAmount=false&rangeMin=0&rangeMax=1000000&groupEditions=1
```

Parameters observed:

| Param            | Meaning                                                        |
|------------------|----------------------------------------------------------------|
| `pageNumber`     | 0-based page index (used when `fullAmount=false`, 20 per page) |
| `sort`           | e.g. `low` (price ascending)                                   |
| `forSaleItemType`| empty = both listed and unlisted                               |
| `rarities`       | URL-encoded JSON array filter, e.g. `[{"type":"Rarity","property":"Mythic"}]` (empty `[]` = all) |
| `fullAmount`     | `true` = single-call bulk fetch of the entire collection        |
| `rangeMin` / `rangeMax` | price range filter                                       |
| `groupEditions`  | `1` groups burn/mint editions                                  |

Per-NFT fields returned:

| Field              | Meaning                                                        |
|--------------------|----------------------------------------------------------------|
| `nft_id`           | XRPL NFTokenID (primary key candidate)                          |
| `item_name`        | NFT name                                                        |
| `issuer`           | Issuer wallet address                                           |
| `token_taxon`      | NFTokenTaxon                                                    |
| `actualowner`      | **Current holding wallet** (populated for listed AND unlisted)  |
| `media_url` / `media_url_sm` | Image URLs (full / thumbnail)                         |
| `amount`           | Listing price in drops, `null` when unlisted                    |
| `background_color` | PFP background color                                            |
| `item_desc`        | Description                                                     |
| `meta_url`         | Metadata URL                                                    |

Rarity filter verified: `rarities=[{"type":"Rarity","property":"Mythic"}]` returned the 11 Mythic Ripple Rogues.

## Ownership data characteristics

- Of 250 minted Ripple Rogues: 27 listed (`amount != null`), 223 unlisted (`amount: null`) — both returned in the same call.
- `actualowner` is present for every NFT, so listed/unlisted state does not affect ownership lookup.

## Proposed usage in Chainframe (House NFT system)

1. **On-demand player check:** server function fetches the collection with `fullAmount=true`, filters `nft.actualowner === playerWalletAddress`. One ~30KB fetch per check.
2. **Cached table + fast refresh:** store the collection in a `house_nfts` DB table (synced from this API, e.g. via "Refresh Houses" button or cron); instant UI loads from SQL; registration re-verifies `actualowner === session.wallet_address` against a fresh fetch (or single-token ledger check) before writing.
3. **Rarity resolution:** pre-index rarity from Endpoint A / NFT metadata into the cache table instead of fetching IPFS JSON per view.

## Rejected alternatives (probed, not viable)

- Bithomp API — 403 without API key.
- XRPL.to API — 404.
- Honeycluster — SSL certificate error.
- Native XRPL `nft_info` RPC — not available on rippled-only public clusters.
- Raw `account_nfts` per player wallet — no issuer/taxon server-side filter, 400-item page cap with marker pagination; unscalable for players holding thousands of tokens.
