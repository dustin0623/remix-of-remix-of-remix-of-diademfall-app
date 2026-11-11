import { useEffect, useMemo, useState } from "react";
import { ClientOnly, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Star } from "lucide-react";
import { MineBoard } from "@/components/game/MineBoard";
import { Button } from "@/components/ui/button";
import { HeroCollectionCard } from "@/components/game/HeroCollectionCard";
import { HeroActions } from "@/components/game/HeroActions";
import { AccountMenuModal } from "@/components/layout/AccountMenuModal";
import { SettingsModal } from "@/components/layout/SidebarModals";
import { HudProfileBody, GameHud } from "@/components/layout/GameHud";
import { HeroActionsPopover } from "@/components/game/HeroActionsPopover";
import { SellHeroDialog } from "@/components/game/SellHeroDialog";
import { DEFAULT_FILTERS, HeroCollectionFilters } from "@/components/game/HeroFilters";
import { MintHeroesContent } from "@/components/game/MintHeroesContent";
import { HeroesEmptyState } from "@/components/game/HeroesEmptyState";
import { filterHeroes, sortCollectionHeroes } from "@/lib/game/heroes/ranking";
import { useGameStore } from "@/features/stores/game.store";
import { validateClaims } from "@/lib/game/session/validate";
import { validateDamage } from "@/lib/game/session/damage";
import { SKILL_INFO, type SkillId } from "@/lib/game/heroes/skills";
import { MAX_HERO_LEVEL } from "@/lib/game/heroes/leveling";
import { HERO_TYPES, HeroRarity, rollHeroAttributes } from "@/game/data/HeroRarity";
import type { PlayerSession, SessionHero, SyncResult } from "@/lib/game/session/types";
import { FusionContent, type FusionOutcome } from "@/components/game/FusionContent";
import { BuyPanel, MarketplaceContent, toHero } from "@/components/game/MarketplaceContent";
import { marketQuote } from "@/lib/game/heroes/market-economy";
import { LeaderboardContent } from "@/components/game/LeaderboardContent";
import { WalletContent, type WalletTab } from "@/components/game/WalletContent";
import { HistoryContent } from "@/components/game/HistoryContent";
import { LEDGER_PAGE_SIZE, ledgerSince, type LedgerRange, type LedgerRecord, type LedgerTab } from "@/lib/game/ledger/ledger";
import { HouseContent } from "@/components/game/HouseContent";
import { HousePicker } from "@/components/game/HousePicker";
import { ProfileContent } from "@/components/game/ProfileContent";
import { countHeroCollection } from "@/lib/game/profile/collection";
import { cosmeticImage, type CosmeticKind } from "@/lib/game/profile/cosmetics";
import type { PlayerProfile } from "@/lib/game/profile/profile.functions";
import type { HouseRarity, PlayerHouse } from "@/lib/game/houses/houses";
import { FUSION_RECIPES, rollFusedHero } from "@/lib/game/heroes/leveling";
import { heroStrength } from "@/lib/game/heroes/ranking";
import type { MarketListing } from "@/lib/game/heroes/market.functions";
import { paginateLeaderboard, type LeaderboardEntry, type LeaderboardResult } from "@/lib/game/leaderboard/leaderboard";
import "@/styles/heroes-collection.css";

/**
 * UI test bench: a copy of the game HUD with mock data. Views switch in place
 * (no extra routes). Nothing is saved; the Play view uses an in-browser fake server.
 */
export const Route = createFileRoute("/test-ui")({
  head: () => ({
    meta: [
      { title: "UI test bench — Vexaria" },
      { name: "description", content: "Offline Vexaria HUD, heroes and gameplay preview with mock data." },
      { property: "og:title", content: "UI test bench — Vexaria" },
      { property: "og:description", content: "Offline Vexaria HUD, heroes and gameplay preview with mock data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TestUi,
});

type View = "heroes" | "play" | "house" | "shop" | "profile" | "fusion" | "marketplace" | "leaderboard" | "wallet" | "history";
const VIEWS: View[] = ["play", "heroes", "house", "shop", "profile", "fusion", "marketplace", "leaderboard", "wallet", "history"];
const RARITIES = [
  HeroRarity.Common, HeroRarity.Common, HeroRarity.Uncommon, HeroRarity.Uncommon,
  HeroRarity.Rare, HeroRarity.Rare, HeroRarity.Epic, HeroRarity.Epic,
  HeroRarity.Legendary, HeroRarity.Legendary,
  // Idle extras so every Fusion tier has three available heroes.
  HeroRarity.Common, HeroRarity.Common, HeroRarity.Common, HeroRarity.Uncommon, HeroRarity.Uncommon, HeroRarity.Uncommon,
  HeroRarity.Rare, HeroRarity.Rare, HeroRarity.Rare, HeroRarity.Epic, HeroRarity.Epic, HeroRarity.Epic,
];
const SKILL_IDS = Object.keys(SKILL_INFO) as SkillId[];

function mockHeroes(): SessionHero[] {
  return RARITIES.map((rarity, i) => {
    const type = HERO_TYPES[i % HERO_TYPES.length] ?? "Rick";
    const a = rollHeroAttributes(rarity);
    return {
      id: `hero_mock_${i}`,
      name: type, type, level: 1 + (i % 5), rarity,
      power: a.power, speed: a.speed, stamina: a.stamina, bombNumber: a.bombNum, bombRange: a.bombRange,
      maxEnergy: a.energy, energy: Math.round(a.energy * (i % 3 === 0 ? 0.3 : 1)),
      onMap: i < 4, recoveryAt: Date.now(),
      skills: SKILL_IDS.slice(0, i % (SKILL_IDS.length + 1)),
    } as SessionHero;
  });
}

function TestUi() {
  const [view, setView] = useState<View>("play");
  const [heroes, setHeroes] = useState<SessionHero[] | null>(null);
  const [shopCoins, setShopCoins] = useState(1250000);
  const [fusionCoins, setFusionCoins] = useState(125000);
  const [demoHouseRarity, setDemoHouseRarity] = useState<HouseRarity>("rare");
  const [walletCoins, setWalletCoins] = useState(12500);
  const [walletTab, setWalletTab] = useState<WalletTab>("deposit");
  const [ledger, setLedger] = useState<LedgerRecord[]>(() => mockLedger(12500));
  const [marketListings, setMarketListings] = useState<MarketListing[]>(() => mockHeroes().map((h, i) => ({
    id: `listing_${i}`, name: h.name, rarity: h.rarity, level: h.level ?? 1, power: h.power, speed: h.speed, stamina: h.stamina,
    bombNumber: h.bombNumber, bombRange: h.bombRange, skills: h.skills ?? [], price: 500 + i * 750, seller: `Merchant${i + 1}`, listedAt: Date.now() - i * 41 * 60000, mine: i === 2,
  })));
  const [cosmetics, setCosmetics] = useState({ avatarId: 0, backgroundId: 200 });
  const coins = useGameStore((s) => s.coins);
  useEffect(() => {
    const empty = new URLSearchParams(window.location.search).has("empty");
    setHeroes(empty ? [] : mockHeroes());
  }, []);

  const game = useGameStore();
  // Burned heroes stay in state for provenance; every live view shows only active ones.
  const activeHeroes = useMemo(() => (heroes === null ? null : heroes.filter((h) => !h.burned)), [heroes]);
  /** Applies an active-only list edit back onto the full roster, keeping burned heroes. */
  const mergeHeroes = (next: SessionHero[]) => setHeroes((all) => (all ?? []).map((h) => next.find((n) => n.id === h.id) ?? h));

  /** Demo payout worker: settles the oldest processing withdrawal like settle_withdrawal would. */
  const settleMockWithdrawal = (ok: boolean) => {
    const target = ledger.find((r) => r.action === "withdrawal" && r.status === "processing");
    if (!target) return;
    const at = new Date().toISOString();
    if (ok) {
      const txHash = mockTxHash();
      setLedger((all) => all.map((r) => (r.id === target.id ? { ...r, status: "completed", updatedAt: at, metadata: { ...r.metadata, txHash } } : r)));
    } else {
      setWalletCoins((c) => c + Math.abs(target.amount));
      setLedger((all) => all.map((r) => (r.id === target.id
        ? { ...r, status: "failed", updatedAt: at, metadata: { ...r.metadata, error: "tecPATH_DRY: no liquidity path", refunded: true } }
        : r)));
    }
  };

  /** Demo deposit watcher: credits a fixed-hash deposit once; repeats are ignored (replay defense). */
  const simulateDeposit = () => {
    if (ledger.some((r) => r.reference === DEMO_DEPOSIT_HASH)) return;
    const amount = 1500;
    const at = new Date().toISOString();
    setWalletCoins((c) => c + amount);
    setLedger((all) => [{ id: (all[0]?.id ?? 0) + 1, category: "transaction", action: "deposit", amount, balanceBefore: walletCoins, balanceAfter: walletCoins + amount, status: "completed", reference: DEMO_DEPOSIT_HASH, metadata: { address: "rDemoSenderWallet", txHash: DEMO_DEPOSIT_HASH }, createdAt: at, updatedAt: at }, ...all]);
  };

  return (
    <GameHud backgroundUrl={cosmeticImage(cosmetics.backgroundId, "background")} coins={view === "play" ? coins : view === "shop" ? shopCoins : view === "fusion" ? fusionCoins : walletCoins} pathname={`/${view}`}
      available={VIEWS.map((v) => `/${v}`)} onNavigate={(path) => { const v = path.slice(1) as View; if (VIEWS.includes(v)) setView(v); }}
      profile={<MockAccount avatarId={cosmetics.avatarId} go={(v) => { if (v === "wallet") setWalletTab("withdraw"); setView(v); }} />}
      wallet={<Button variant="ghost" className="hud-plus" aria-label="Open wallet" onClick={() => { setWalletTab("deposit"); setView("wallet"); }}><Plus /></Button>}>
      <MockSession />
      {view === "heroes" ? (
        <div className="hud-collection hc-shell">{activeHeroes && <MockHeroes heroes={activeHeroes} setHeroes={mergeHeroes} houseRarity={demoHouseRarity} onShop={() => setView("shop")} />}</div>
      ) : view === "shop" ? (
        <div className="hud-summoning"><MintHeroesContent
          preview={{ coins: shopCoins, mint: async (count) => mockHeroes().slice(0, count).map((h, i) => ({ ...h, id: `hero_mock_mint_${Date.now()}_${i}`, onMap: false })) }}
          onMinted={(minted, balance) => { setHeroes((current) => [...(current ?? []), ...minted]); setShopCoins(balance); }} /></div>
      ) : view === "fusion" ? (
        <div className="hud-fusion"><FusionContent heroes={activeHeroes} coins={fusionCoins} fuse={async (ids) => {
          const result = await mockFuse(heroes ?? [], ids, setHeroes, fusionCoins);
          setFusionCoins((balance) => balance - result.fee);
          const at = new Date().toISOString();
          setLedger((all) => [{ id: (all[0]?.id ?? 0) + 1, category: "economy", action: "fusion", amount: -result.fee, balanceBefore: fusionCoins, balanceAfter: fusionCoins - result.fee, status: "completed", reference: result.success ? result.hero!.id : result.burnedIds[0]!, metadata: result.success
            ? { rarity: result.rarity, success: true, hero: result.hero!.name, heroRarity: result.hero!.rarity, heroLevel: result.hero!.level ?? 1, newHeroId: result.hero!.id, burnedHeroIds: result.burnedIds }
            : { rarity: result.rarity, success: false, burnedHeroId: result.burnedIds[0]!, ...(result.burnedName ? { burnedHeroName: result.burnedName } : {}) }, createdAt: at, updatedAt: at }, ...all]);
          return result;
        }} /></div>
      ) : view === "marketplace" ? (
        <div className="hud-collection hc-shell"><MarketplaceContent listings={marketListings} error={null} connected renderBuy={(l) => <BuyPanel listing={l} coins={walletCoins} onDeposit={() => { setWalletTab("deposit"); setView("wallet"); }}
          buy={async (listing) => {
            if (listing.mine || !marketListings.some((item) => item.id === listing.id)) throw new Error("Hero unavailable");
            if (walletCoins < listing.price) throw new Error("Insufficient coins");
            const quote = marketQuote(listing.price);
            const base = toHero(listing);
            const hero = { ...base, energy: base.maxEnergy, onMap: false, listed: false };
            return { coins: walletCoins - listing.price, hero, fee: quote.fee, proceeds: quote.proceeds, reference: `mock-market-${Date.now()}` };
          }} onPurchased={(result) => {
            setMarketListings((all) => all.filter((item) => item.id !== l.id));
            setHeroes((all) => [...(all ?? []), result.hero]);
            setWalletCoins(result.coins);
            const at = new Date().toISOString();
            setLedger((all) => [{ id: (all[0]?.id ?? 0) + 1, category: "economy", action: "market_purchase", amount: -l.price, balanceBefore: walletCoins, balanceAfter: result.coins, status: "completed", reference: result.reference, metadata: { hero: l.name, rarity: l.rarity, level: l.level, seller: l.seller, price: l.price, payment: "coins", feeBurned: result.fee, sellerProceeds: result.proceeds, feePercent: 5 }, createdAt: at, updatedAt: at }, ...all]);
          }} />} /></div>
      ) : view === "leaderboard" ? (
        <div className="hud-rankings"><LeaderboardContent fetchPage={mockLeaderboard} /></div>
      ) : view === "profile" ? (
        <div className="hud-account-page"><MockProfile cosmetics={cosmetics} onEquip={async (kind, id) => setCosmetics((current) => ({ ...current, [`${kind}Id`]: id }))} heroes={activeHeroes ?? []} house={<HousePicker selected={demoHouseRarity} onChoose={async (rarity) => { setDemoHouseRarity(rarity); setHeroes((all) => all?.map((h) => ({ ...h, houseId: undefined, houseRarity: undefined })) ?? null); }} onOpen={() => setView("house")} />} /></div>
      ) : view === "wallet" ? (
        <div className="hud-wallet-page"><WalletContent coins={walletCoins} walletAddress="Demo connected wallet" deposit={{ address: null, tag: 123456 }} preview initialTab={walletTab} onRefresh={() => {}} onOpenHistory={() => setView("history")} onWithdraw={async (amount) => {
          if (!Number.isSafeInteger(amount) || amount < 1 || amount > walletCoins) throw new Error("Invalid withdrawal amount");
          const transactionId = `mock-withdraw-${Date.now()}`;
          setWalletCoins((current) => current - amount);
          const at = new Date().toISOString();
          setLedger((current) => [{ id: (current[0]?.id ?? 0) + 1, category: "transaction", action: "withdrawal", amount: -amount, balanceBefore: walletCoins, balanceAfter: walletCoins - amount, status: "processing", reference: transactionId, metadata: { address: "Demo connected wallet" }, createdAt: at, updatedAt: at }, ...current]);
          return { coins: walletCoins - amount, transactionId };
        }} /></div>
      ) : view === "history" ? (
        <div className="hud-history-page"><MockHistory coins={walletCoins} records={ledger} onBack={() => setView("wallet")}
          onPayoutSuccess={() => settleMockWithdrawal(true)} onPayoutFailure={() => settleMockWithdrawal(false)} onDeposit={simulateDeposit}
          payoutPending={ledger.some((r) => r.action === "withdrawal" && r.status === "processing")} /></div>
      ) : view === "house" ? (
        <MockHouse heroes={activeHeroes ?? []} rarity={demoHouseRarity} />
      ) : (
        <ClientOnly><MineBoard player={{ id: "test-player" }} session={game.session} stage={game.stage}
          saveStatus={game.saveStatus} stageClearing={game.stageClearing} gamePaused={game.gamePaused}
          superseded={false} activePlayers={7} playHere={() => {}} /></ClientOnly>
      )}
    </GameHud>
  );
}

function MockProfile({ heroes, house, cosmetics, onEquip }: { heroes: SessionHero[]; house: import("react").ReactNode; cosmetics: { avatarId: number; backgroundId: number }; onEquip: (kind: CosmeticKind, id: number) => Promise<void> }) {
  const [profile, setProfile] = useState<PlayerProfile>(() => ({
    username: "MockPlayer", memberSince: "2026-01-01T00:00:00Z", coins: 12500, xp: 42000, level: 7,
    totalGoldClaimed: 125000, totalChests: 123, chests: { common: 80, uncommon: 25, rare: 12, epic: 5, legendary: 1 },
    heroes: countHeroCollection(heroes), avatarId: 0, backgroundId: 200,
  }));
  return <ProfileContent profile={{ ...profile, ...cosmetics, heroes: countHeroCollection(heroes) }} houseRegistration={house}
    rename={async (username) => setProfile((p) => ({ ...p, username }))}
    onEquip={onEquip} />;
}

function MockHouse({ heroes, rarity }: { heroes: SessionHero[]; rarity: HouseRarity }) {
  const houses: PlayerHouse[] = [{ id: "house-mock", nftId: "mock-only", rarity, isDemo: true, registeredAt: "2026-01-01T00:00:00Z" }];
  return <HouseContent houses={houses} heroes={heroes} selectedId="house-mock" now={Date.now()} />;
}
/** Mock fusion following the shared recipe: soft-burns like the server — burned heroes stay in state flagged `burned`. */
async function mockFuse(heroes: SessionHero[], ids: string[], setHeroes: (h: SessionHero[]) => void, coins: number): Promise<FusionOutcome & { fee: number; rarity: string; burnedIds: string[]; burnedName?: string }> {
  const picked = heroes.filter((h) => ids.includes(h.id));
  const recipe = FUSION_RECIPES.find((r) => r.from === picked[0]?.rarity);
  if (!recipe || new Set(ids).size !== 3 || picked.length !== 3 || picked.some((h) => h.rarity !== recipe.from || h.onMap || h.houseId || h.listed || h.burned)) throw new Error("Pick 3 available heroes of the same rarity");
  if (coins < recipe.fee) throw new Error("Not enough coins");
  await new Promise((r) => setTimeout(r, 600));
  const burn = (burnIds: string[]) => heroes.map((h) => (burnIds.includes(h.id) ? { ...h, burned: true, onMap: false, houseId: undefined, houseRarity: undefined, listed: false } : h));
  if (Math.random() < recipe.chance) {
    const base = picked[0]!;
    const rolled = rollFusedHero(recipe, picked.map((h) => h.level ?? 1));
    const hero = { ...base, ...rolled, name: rolled.type, id: `hero_mock_fused_${Date.now()}`, energy: rolled.maxEnergy, onMap: false } as SessionHero;
    setHeroes([...burn(ids), hero]);
    return { success: true, hero, fee: recipe.fee, rarity: recipe.from, burnedIds: ids, message: `Success! New Lv. ${hero.level} ${recipe.to} hero: ${hero.name}.` };
  }
  const weakest = [...picked].sort((a, b) => heroStrength(a) - heroStrength(b) || a.id.localeCompare(b.id))[0]!;
  setHeroes(burn([weakest.id]));
  return { success: false, fee: recipe.fee, rarity: recipe.from, burnedIds: [weakest.id], burnedName: weakest.name, message: "Fusion failed — the weakest hero was burned, the other two are safe." };
}

const MOCK_NAMES = ["Ashveil", "Brimstone", "Cobalt", "Dunewalker", "Emberly", "Flint", "Gravel", "Hollow", "Ironjaw", "Jasper", "Kestrel", "Lumen"];
const MOCK_BOARD: LeaderboardEntry[] = Array.from({ length: 250 }, (_, i) => ({
  rank: i + 1, playerId: i === 6 ? "test-player" : `mock_${i}`, username: i === 6 ? "MockPlayer" : `${MOCK_NAMES[i % MOCK_NAMES.length]}${i >= 12 ? i : ""}`,
  avatarId: i % 6, level: Math.max(1, 30 - Math.floor(i / 2)), xp: 90000 - i * 300, heroCount: Math.max(1, 40 - Math.floor(i / 8)), heroPoints: 30000 - i * 100, score: 120000 - i * 400,
}) as unknown as LeaderboardEntry);
async function mockLeaderboard(page: number): Promise<LeaderboardResult> {
  const { entries, page: currentPage, pageCount } = paginateLeaderboard(MOCK_BOARD, page);
  await new Promise((r) => setTimeout(r, 200));
  return { entries, page: currentPage, pageCount, totalPlayers: MOCK_BOARD.length, asOf: new Date().toISOString(), self: MOCK_BOARD[6]! };
}

function MockHeroes({ heroes, setHeroes, houseRarity, onShop }: { heroes: SessionHero[]; setHeroes: (h: SessionHero[]) => void; houseRarity: HouseRarity; onShop: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selling, setSelling] = useState<SessionHero | null>(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const selected = heroes.find((h) => h.id === selectedId);
  const shown = useMemo(() => sortCollectionHeroes(filterHeroes(heroes, filters), "heroes", filters.sort), [heroes, filters]);
  const onMapCount = heroes.filter((h) => h.onMap).length;
  const patch = (id: string, p: Partial<SessionHero>) => setHeroes(heroes.map((h) => (h.id === id ? { ...h, ...p } : h)));
  return (
    <section className="hc-page panel-page" aria-label="Heroes">
      <div className="hc-layout">
        <div className="hc-collection">
          <div className="hc-toolbar panel-head">
            <div className="hc-filters">
              <HeroCollectionFilters value={filters} onChange={setFilters} heroes={heroes} />
            </div>
          </div>
          <div className="hc-results panel-scroll" role="region" aria-label="Hero collection" tabIndex={0}>
          {heroes.length === 0 ? <HeroesEmptyState onShop={onShop} /> : shown.length ? <div className="hc-grid">
            {shown.map((hero) => <HeroActionsPopover key={hero.id} hero={hero} open={selectedId === hero.id} onOpenChange={(open) => setSelectedId(open ? hero.id : null)} restoreFocus={!selling}
 actions={<HeroActions hero={hero} layout="popover" onMapCount={onMapCount}
 onToggle={() => patch(hero.id, { onMap: !hero.onMap })}
 onLevelUp={() => patch(hero.id, { level: Math.min(MAX_HERO_LEVEL, (hero.level ?? 1) + 1) })}
 onSell={() => { setSelectedId(null); setSelling(hero); }}
 onCancelSale={() => patch(hero.id, { listed: false, marketPrice: undefined })}
 onLeaveHouse={() => patch(hero.id, { houseId: undefined, houseRarity: undefined })}
 onRestInHouse={() => patch(hero.id, { houseId: "house-mock", houseRarity, onMap: false })} />}>
 <HeroCollectionCard hero={hero} selected={selectedId === hero.id} popoverOpen={selectedId === hero.id} onSelect={() => setSelectedId((id) => id === hero.id ? null : hero.id)} />
 </HeroActionsPopover>)}
          </div> : <div className="hc-empty"><p>No heroes match these filters.</p><Button variant="outline" onClick={() => setFilters(DEFAULT_FILTERS)}>Clear filters</Button></div>}
          </div>
        </div>
<SellHeroDialog hero={selling} preview={{ list: async () => {} }} onClose={() => setSelling(null)} onListed={(id, price) => patch(id, { listed: true, marketPrice: price })} />
      </div>
    </section>
  );
}

interface FakeMap { stage: number; seed: number; destroyed: string[]; damaged: Record<string, number>; lastSync: number; coins: number }
declare global {
  interface Window { __testGame?: { server: FakeMap; log: string[] } }
}

function MockSession() {
  const setSession = useGameStore((s) => s.setSession);

  useEffect(() => {
    const previous = useGameStore.getState();
    useGameStore.setState({ coins: 0, stage: 1, roster: [], commands: [], stageClearing: false, gamePaused: false, saveStatus: "saved" });
    const server: FakeMap = { stage: 1, seed: 12345, destroyed: [], damaged: {}, lastSync: Date.now(), coins: 0 };
    window.__testGame = { server, log: [] };
    const heroes = mockHeroes().map((h) => ({ ...h, energy: h.maxEnergy, onMap: h.onMap ?? false }));
    const loaded: PlayerSession = { playerId: "test-player", coins: 0, stage: 1, seed: server.seed, destroyedNodes: [], heroes };
    setSession(
      loaded,
      async (seed, keys, damaged = {}): Promise<SyncResult> => {
        const reply = (accepted: number, rejected: number): SyncResult => ({
          ok: true, coins: server.coins, stage: server.stage, seed: server.seed, destroyedNodes: [...server.destroyed], damagedNodes: { ...server.damaged }, accepted, rejected,
        });
        if (seed !== server.seed) return reply(0, keys.length);
        const out = validateClaims({ stage: server.stage, seed: server.seed, destroyed: server.destroyed, claimed: keys, elapsedMs: Date.now() - server.lastSync });
        const partial = validateDamage({ stage: server.stage, seed: server.seed, destroyed: out.destroyed, stored: server.damaged, reported: damaged, lethal: [], budget: Number.MAX_SAFE_INTEGER });
        server.damaged = { ...server.damaged, ...partial.damaged };
        for (const key of out.destroyed) delete server.damaged[key];
        server.lastSync = Date.now();
        if (out.accepted) {
          server.coins += out.coins;
          server.destroyed = out.destroyed;
          if (out.cleared) {
            server.stage++;
            server.seed = Math.floor(Math.random() * 2147483647);
            server.destroyed = [];
            server.damaged = {};
          }
        }
        window.__testGame?.log.push(`sync keys=${keys.length} ok=${out.accepted} rej=${out.rejected}`);
        return reply(out.accepted, out.rejected);
      },
      async () => {},
    );
    return () => {
      useGameStore.setState(previous);
      delete window.__testGame;
    };
  }, [setSession]);
  return null;
}

function MockAccount({ go, avatarId }: { go: (view: View) => void; avatarId: number }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const stage = useGameStore((s) => s.stage);
  return <><AccountMenuModal open={open} onOpenChange={setOpen}
    name="MockPlayer" avatarUrl={cosmeticImage(avatarId, "avatar")} level={7}
    onSelect={(a) => { if (a === "profile") go(a); else if (a === "wiki") void navigate({ to: "/wiki" }); else if (a === "withdraw") go("wallet"); else if (a === "history") go("history"); else if (a === "settings") setSettings(true); }}
    trigger={<button type="button" className="hud-profile" aria-label="Mock account">
      <HudProfileBody name="MockPlayer" stage={stage} avatarUrl={cosmeticImage(avatarId, "avatar")} level={<><Star fill="currentColor" /> 7</>} />
    </button>} />
    <SettingsModal open={settings} onOpenChange={setSettings} /></>;
}

/** Fixed 64-hex demo hash so repeated "Incoming deposit" clicks prove idempotency. */
const DEMO_DEPOSIT_HASH = "A1B2C3D4E5F60718293A4B5C6D7E8F90112233445566778899AABBCCDDEEFF00";
const mockTxHash = () => Array.from({ length: 64 }, () => "0123456789ABCDEF"[Math.floor(Math.random() * 16)]).join("");

/** Demo ledger covering every record type, newest first, with a consistent before/after balance chain. */
function mockLedger(finalBalance: number): LedgerRecord[] {
  const now = Date.now();
  const H = 3_600_000;
  const entries: Omit<LedgerRecord, "id" | "balanceBefore" | "balanceAfter" | "createdAt" | "updatedAt">[] = [
    { category: "gameplay", action: "stage_rewards", amount: 1840, status: "completed", reference: "88812", metadata: { stage: 4, cleared: false, xp: 920, chests: { common: 5, uncommon: 2, rare: 1 } } },
    { category: "economy", action: "level_up", amount: -5000, status: "completed", reference: "hero_mock_1", metadata: { hero: "Rocky", rarity: "common", fromLevel: 1, toLevel: 2 } },
    { category: "transaction", action: "withdrawal", amount: -2500, status: "processing", reference: "6f1c2a9e-3b4d-4e5f-8a7b-1c2d3e4f5a6b", metadata: { address: "Demo connected wallet" } },
    { category: "gameplay", action: "stage_rewards", amount: 6200, status: "completed", reference: "77341", metadata: { stage: 3, cleared: true, xp: 3100, chests: { common: 9, uncommon: 4, rare: 2, epic: 1 } } },
    { category: "economy", action: "market_sale", amount: 0, status: "completed", reference: "A1B2C3D4E5F60718293A", metadata: { hero: "Ghost", rarity: "rare", level: 3, price: 4250, buyer: "Emberly" } },
    { category: "economy", action: "fusion", amount: -2000, status: "completed", reference: "hero_mock_fused", metadata: { rarity: "common", success: true, hero: "Bolt", heroRarity: "uncommon", heroLevel: 2 } },
    { category: "economy", action: "mint_hero", amount: -3000, status: "completed", reference: null, metadata: { count: 3, heroes: [{ name: "Rick", rarity: "common", level: 1 }, { name: "Moss", rarity: "uncommon", level: 2 }, { name: "Tim", rarity: "common", level: 1 }] } },
    { category: "transaction", action: "withdrawal", amount: -1000, status: "failed", reference: "0a9b8c7d-6e5f-4a3b-2c1d-0e9f8a7b6c5d", metadata: { address: "Demo connected wallet" } },
    { category: "gameplay", action: "stage_rewards", amount: 4700, status: "completed", reference: "55120", metadata: { stage: 2, cleared: true, xp: 2350, chests: { common: 12, uncommon: 3, rare: 1 } } },
    { category: "economy", action: "market_purchase", amount: 0, status: "completed", reference: "F0E1D2C3B4A596877869", metadata: { hero: "Ducky", rarity: "epic", level: 4, price: 12000, seller: "Merchant7" } },
    { category: "gameplay", action: "stage_rewards", amount: 3260, status: "completed", reference: "12345", metadata: { stage: 1, cleared: true, xp: 1630, chests: { common: 14, uncommon: 1 } } },
  ];
  let after = finalBalance;
  return entries.map((e, i) => {
    const at = new Date(now - (i * 9 + 1) * H).toISOString();
    const row = { ...e, id: entries.length - i, balanceAfter: after, balanceBefore: after - e.amount, createdAt: at, updatedAt: at };
    after -= e.amount;
    return row;
  });
}

function MockHistory({ coins, records, onBack, onPayoutSuccess, onPayoutFailure, onDeposit, payoutPending }: {
  coins: number; records: LedgerRecord[]; onBack: () => void;
  onPayoutSuccess: () => void; onPayoutFailure: () => void; onDeposit: () => void; payoutPending: boolean;
}) {
  const [tab, setTab] = useState<LedgerTab>("transaction");
  const [range, setRange] = useState<LedgerRange>("30days");
  const [shown, setShown] = useState(LEDGER_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    setShown(LEDGER_PAGE_SIZE);
    const t = setTimeout(() => setLoading(false), 350);
    return () => clearTimeout(t);
  }, [tab, range]);
  const since = ledgerSince(range, new Date(), new Date().getTimezoneOffset());
  const matching = records.filter((r) => r.category === tab && (!since || new Date(r.updatedAt) >= since));
  const page = { records: matching.slice(0, shown), total: matching.length, net: matching.reduce((s, r) => s + r.amount, 0) };
  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "0 4px 10px" }}>
        <span style={{ fontSize: 12, opacity: 0.7 }}>Demo payout worker:</span>
        <Button variant="outline" size="sm" disabled={!payoutPending} onClick={onPayoutSuccess}>Payout success</Button>
        <Button variant="outline" size="sm" disabled={!payoutPending} onClick={onPayoutFailure}>Payout failure</Button>
        <Button variant="outline" size="sm" onClick={onDeposit}>Incoming deposit</Button>
      </div>
      <HistoryContent preview coins={coins} tab={tab} range={range} page={page} loading={loading} onTabChange={setTab} onRangeChange={setRange}
        onLoadMore={() => setShown((n) => n + LEDGER_PAGE_SIZE)} onRefresh={() => { setLoading(true); setTimeout(() => setLoading(false), 350); }} onBack={onBack} />
    </>
  );
}
