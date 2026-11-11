import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  Coins,
  HeartPulse,
  Info,
  ShieldCheck,
  Swords,
  Users,
} from "lucide-react";
import { ConnectWalletModal } from "@/components/auth/ConnectWalletModal";
import { useAuthStore } from "@/features/stores/auth.store";
import { cosmeticImage } from "@/lib/game/profile/cosmetics";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HeroSprite } from "@/components/game/HeroSprite";
import { HERO_RARITY_DEFS, HERO_TYPES, HERO_SPRITES, HeroRarity } from "@/game/data/HeroRarity";
import { CHEST_STATS, ChestRarity } from "@/game/data/ChestRarity";
import {
  ENERGY_PER_STAMINA,
  ENERGY_RECOVERY_PER_HOUR,
  MAX_ON_MAP,
  MINT_COST,
  MIN_DEPLOY_ENERGY_FRACTION,
} from "@/lib/config/constants/game";
import { HOUSE_TIERS, HOUSE_RARITIES } from "@/lib/game/houses/houses";
import { SKILL_IDS, SKILL_INFO, QUICK_REST_MULTIPLIER } from "@/lib/game/heroes/skills";
import { MAX_MINT_PER_TX } from "@/lib/game/heroes/mint";
import { MAX_HERO_LEVEL, levelUpCost } from "@/lib/game/heroes/leveling";
import { xpForLevel } from "@/lib/game/profile/level";
import { WikiNavigation } from "./WikiNavigation";

const fmt = (n: number) => n.toLocaleString("en-US");
const rarityColor: Record<string, string> = {
  common: "text-rarity-common",
  uncommon: "text-rarity-uncommon",
  rare: "text-rarity-rare",
  epic: "text-rarity-epic",
  legendary: "text-rarity-legendary",
};
function Rarity({ rarity }: { rarity: string }) {
  return (
    <span className={`font-medium capitalize ${rarityColor[rarity] ?? "text-foreground"}`}>
      {rarity}
    </span>
  );
}
function Section({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} tabIndex={-1} className="wiki-section">
      <div className="wiki-section-heading">
        <span>{String(number).padStart(2, "0")}</span>
        <h2>{title}</h2>
        <a href={`#${id}`} aria-label={`Link to ${title}`} className="wiki-permalink">
          #
        </a>
      </div>
      <div className="wiki-section-content">{children}</div>
    </section>
  );
}
function DataTable({
  label,
  headers,
  rows,
}: {
  label: string;
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="wiki-table-scroll">
      <table className="wiki-table">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            {headers.map((h) => (
              <th scope="col" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i}>
              {cells.map((c, j) =>
                j === 0 ? (
                  <th key={j} scope="row">
                    {c}
                  </th>
                ) : (
                  <td key={j}>{c}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Note({ children }: { children: ReactNode }) {
  return (
    <aside className="wiki-note">
      <Info size={18} aria-hidden="true" />
      <div>{children}</div>
    </aside>
  );
}

function WikiPlayLink() {
  const connected = useAuthStore((s) => s.player !== null);
  const content = (
    <>
      <Swords size={16} />
      <span>Enter the mine</span>
      <ArrowRight size={15} />
    </>
  );
  return connected ? (
    <Link to="/play" className="wiki-play-link">
      {content}
    </Link>
  ) : (
    <ConnectWalletModal>
      <button type="button" className="wiki-play-link">
        {content}
      </button>
    </ConnectWalletModal>
  );
}

export function WikiPage() {
  return (
    <div className="wiki-page" id="wiki-top">
      <a className="wiki-skip" href="#wiki-article">
        Skip to the guide
      </a>
      <header className="wiki-header">
        <div className="wiki-header-inner">
          <Link to="/" className="wiki-brand" aria-label="Vexaria home">
            <img src="/brand/game-logo.png" alt="Vexaria" width={136} height={54} />
          </Link>
          <span className="wiki-header-label">
            <BookOpen size={15} /> THE WIKI
          </span>
          <nav aria-label="Wiki main navigation">
            <Link to="/" className="wiki-home-link">
              <ArrowLeft size={14} /> Homepage
            </Link>
            <WikiPlayLink />
          </nav>
        </div>
      </header>
      <main className="wiki-wrap">
        <div className="wiki-intro">
          <div>
            <span className="wiki-eyebrow">VEXARIA WIKI · THE PLAYER'S FIELD GUIDE</span>
            <h1>Adventure, explained.</h1>
            <p>
              Get to know your crew, find your rhythm and make every expedition count. All the rules
              of the mine, in one place.
            </p>
            <a href="#getting-started" className="wiki-intro-link">
              New to the valley? Start here <ArrowRight size={15} />
            </a>
          </div>
          <div className="wiki-intro-art" aria-hidden="true">
            <span className="wiki-art-orbit" />
            <img
              className="wiki-art-side wiki-art-moss"
              src={cosmeticImage(7, "avatar")}
              alt=""
              width={104}
              height={104}
            />
            <img
              className="wiki-art-main"
              src={cosmeticImage(0, "avatar")}
              alt=""
              width={138}
              height={138}
            />
            <img
              className="wiki-art-side wiki-art-ducky"
              src={cosmeticImage(4, "avatar")}
              alt=""
              width={104}
              height={104}
            />
            <span className="wiki-art-caption">A LITTLE KNOW-HOW. A BIG ADVENTURE.</span>
          </div>
        </div>
        <div className="wiki-body">
          <WikiNavigation />
          <article
            id="wiki-article"
            tabIndex={-1}
            className="wiki-article"
            aria-label="Player guide"
          >
            <div className="wiki-essentials">
              <span className="wiki-eyebrow">THE ESSENTIALS</span>
              <dl>
                <div>
                  <dt>
                    <Coins size={15} /> Hero mint
                  </dt>
                  <dd>
                    {fmt(MINT_COST)} <span>coins</span>
                  </dd>
                </div>
                <div>
                  <dt>
                    <Users size={15} /> Active crew
                  </dt>
                  <dd>
                    {MAX_ON_MAP} <span>heroes max</span>
                  </dd>
                </div>
                <div>
                  <dt>
                    <HeartPulse size={15} /> Natural recovery
                  </dt>
                  <dd>
                    {ENERGY_RECOVERY_PER_HOUR} <span>energy / hour</span>
                  </dd>
                </div>
              </dl>
            </div>

            <Section id="getting-started" number={1} title="Start playing">
              <p>
                Vexaria is an idle bomber mining game on XRPL. Your heroes explore automatically,
                plant bombs and break treasure chests. You manage the crew and their recovery.
              </p>
              <ol className="wiki-start-steps">
                <li>
                  <strong>Connect with Xaman.</strong> Scan the QR code or open the wallet link and
                  approve the sign-in request. Your private keys stay in your wallet; there is no
                  email or password login.
                </li>
                <li>
                  <strong>Build your roster.</strong> Mint heroes in Shop using your available
                  in-game coins. Review their stats and skills in Heroes.
                </li>
                <li>
                  <strong>Deploy an eligible crew.</strong> Heroes need at least{" "}
                  {MIN_DEPLOY_ENERGY_FRACTION * 100}% energy, must not be assigned to a house or
                  listed for sale, and count toward the {MAX_ON_MAP}-hero map limit.
                </li>
                <li>
                  <strong>Mine, then rest.</strong> Keep Play open for active mining. Recall tired
                  heroes or rest them in a house. Off-map energy recovery continues while you are
                  away.
                </li>
              </ol>
              <WikiPlayLink />
              <p className="wiki-audio-tip">
                <strong>Set the mood.</strong> Open your account menu → Audio settings to adjust
                overall volume and bomb effects, mute the game or test a sound. Preferences are
                saved on this device.
              </p>
            </Section>

            <Section id="heroes" number={2} title="Heroes & rarity">
              <p>
                Each mint rolls a rarity, appearance, attributes and passive skills. Appearance is
                cosmetic: two heroes who look alike can have different stats. Names identify your
                crew; each hero also has a unique saved identity.
              </p>
              <div className="grid grid-cols-5 gap-y-5 py-3 sm:grid-cols-10">
                {HERO_TYPES.map((type) => (
                  <div key={type} className="flex flex-col items-center gap-2">
                    <HeroSprite sprite={HERO_SPRITES[type]} scale={2} />
                    <span className="text-center text-[10px] leading-4">{type}</span>
                  </div>
                ))}
              </div>
              <DataTable
                label="Hero rarity and attribute ranges"
                headers={["Rarity", "Mint chance", "Power", "Speed", "Stamina", "Bombs", "Range"]}
                rows={Object.values(HeroRarity).map((r) => {
                  const d = HERO_RARITY_DEFS[r];
                  return [
                    <Rarity rarity={r} />,
                    `${d.weight}%`,
                    `${d.power.min}–${d.power.max}`,
                    `${d.speed.min}–${d.speed.max}`,
                    `${d.stamina.min}–${d.stamina.max}`,
                    `${d.bombNum.min}–${d.bombNum.max}`,
                    `${d.bombRange.min}–${d.bombRange.max}`,
                  ];
                })}
              />
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>Power:</strong> damage dealt by a blast, before applicable skill bonuses.
                </li>
                <li>
                  <strong>Speed:</strong> movement rate through the mine.
                </li>
                <li>
                  <strong>Stamina:</strong> determines maximum energy, not hourly natural recovery.
                </li>
                <li>
                  <strong>Bombs:</strong> maximum simultaneous bombs for that hero.
                </li>
                <li>
                  <strong>Range:</strong> blast reach along each of the four directions, subject to
                  obstacles.
                </li>
              </ul>
              <p>
                Minted stats roll independently within the rarity ranges. Starting level is{" "}
                <strong>1 + total stat points above the rarity minimums</strong>: two bonus points
                mean a Level 3 hero. Each upgrade adds +1 to a random unmaxed stat; Level{" "}
                {MAX_HERO_LEVEL} means every stat is maxed. Player XP does not automatically
                increase hero attributes. Existing heroes keep their saved stats and level.
              </p>
              <p>
                Upgrading costs <strong>current hero level² × 5,000 coins</strong>. Level 1→2 costs{" "}
                {fmt(levelUpCost(1) ?? 0)} coins; Level 2→3 costs {fmt(levelUpCost(2) ?? 0)} coins.
              </p>
            </Section>

            <Section id="combat" number={3} title="Bombs & stages">
              <p>
                Heroes choose paths and bomb nearby targets automatically. Blasts extend in a cross:
                up, down, left and right. Solid walls block explosions; destructible bushes and
                chests normally stop that blast direction. Pierce can carry a blast through one
                destructible obstacle.
              </p>
              <p>
                Planting a bomb normally spends <strong>1 energy</strong>. Conserve can waive that
                cost. One explosion can damage multiple targets, and several heroes can work on the
                same chest. Bushes cost energy to clear but do not pay chest coins.
              </p>
              <p>
                A stage ends when <strong>every chest is destroyed</strong>; remaining bushes do not
                have to be cleared. The next stage receives a new layout. Chest placement and rarity
                vary between stages.
              </p>
              <Note>
                Idle does not mean offline mining. The mine must be running for bombs to be planted.
                Pausing or leaving stops active mining, while eligible resting heroes continue to
                recover.
              </Note>
            </Section>

            <Section id="chests" number={4} title="Chest rewards">
              <p>
                Coins are awarded only when a chest reaches <strong>0 HP</strong>. Partial hits
                reduce its remaining health but do not pay a proportional reward. The table shows
                base rewards before Bonus Pay.
              </p>
              <DataTable
                label="Chest health and base rewards"
                headers={["Chest", "Appearance", "HP", "Coins", "Map chance"]}
                rows={Object.values(ChestRarity).map((r) => {
                  const c = CHEST_STATS[r];
                  return [
                    <Rarity rarity={r} />,
                    <img
                      src={`/game/items/chests/chest_${r}.png`}
                      alt={`${r} chest`}
                      className="pixelated h-9 w-auto"
                    />,
                    fmt(c.hp),
                    fmt(c.coins),
                    `${c.weight}%`,
                  ];
                })}
              />
              <p>
                These chances apply to chest rarity, not hero mint rarity. A stage does not have a
                guaranteed reward pot: its total depends on the chests generated and any applicable
                reward bonus.
              </p>
            </Section>

            <Section id="energy" number={5} title="Energy & recovery">
              <p>
                <strong>Maximum energy = stamina × {ENERGY_PER_STAMINA}.</strong> Natural recovery
                is a flat <strong>{ENERGY_RECOVERY_PER_HOUR} energy per hour</strong> for every
                rarity, capped at the hero’s maximum. Heroes recover off the map; they do not
                regenerate while mining.
              </p>
              <DataTable
                label="Energy capacity and full natural recovery"
                headers={["Rarity", "Energy range", "Empty → full"]}
                rows={Object.values(HeroRarity).map((r) => {
                  const s = HERO_RARITY_DEFS[r].stamina;
                  return [
                    <Rarity rarity={r} />,
                    `${s.min * ENERGY_PER_STAMINA}–${s.max * ENERGY_PER_STAMINA}`,
                    `${(s.min * ENERGY_PER_STAMINA) / ENERGY_RECOVERY_PER_HOUR}–${(s.max * ENERGY_PER_STAMINA) / ENERGY_RECOVERY_PER_HOUR} hours`,
                  ];
                })}
              />
              <p>
                Deployment requires at least{" "}
                <strong>{MIN_DEPLOY_ENERGY_FRACTION * 100}% of maximum energy</strong>, rounded up
                to a whole energy point. An exhausted hero must recover to that threshold before
                returning. Recalling a hero does not instantly refill it.
              </p>
              <p>
                <strong>Example:</strong> 5 stamina gives 250 maximum energy. At the natural rate,
                empty to full takes 5 hours; reaching the 125-energy deployment threshold takes 2.5
                hours.
              </p>
              <p>
                There is <strong>no daily chest quota</strong>. Energy and the crew’s ability to
                damage targets are the earning constraints.
              </p>
            </Section>

            <Section id="skills" number={6} title="Passive skills">
              <p>
                Skills are rolled at mint and are distinct within a hero. Common heroes have a 20%
                chance of one skill; Uncommon receives 1, Rare 2, Epic 3 and Legendary 4.
              </p>
              <dl className="divide-y divide-border">
                {SKILL_IDS.map((id) => (
                  <div key={id} className="grid gap-1 py-3 sm:grid-cols-[130px_1fr]">
                    <dt className="font-medium text-foreground">{SKILL_INFO[id].name}</dt>
                    <dd>
                      {id === "quick_rest"
                        ? `Recovers energy ${QUICK_REST_MULTIPLIER}× faster off-map, including house recovery.`
                        : SKILL_INFO[id].effect}
                    </dd>
                  </div>
                ))}
              </dl>
            </Section>

            <Section id="houses" number={7} title="Houses">
              <p>
                Houses provide additional energy recovery to assigned heroes. Register a house
                through Profile, then open House to manage resting heroes. You can also choose Rest
                in house from a hero’s menu.
              </p>
              <DataTable
                label="House capacity and recovery rates"
                headers={["Rarity", "House", "Slots", "Bonus / hour", "Total / hour"]}
                rows={HOUSE_RARITIES.map((r) => {
                  const h = HOUSE_TIERS[r];
                  return [
                    <Rarity rarity={r} />,
                    h.name,
                    h.slots,
                    `+${h.bonusPerHour}`,
                    h.bonusPerHour + ENERGY_RECOVERY_PER_HOUR,
                  ];
                })}
              />
              <p>
                <strong>
                  Recovery per hour = (natural rate + house bonus) × Quick Rest multiplier.
                </strong>{" "}
                The multiplier is {QUICK_REST_MULTIPLIER} when the hero has Quick Rest, otherwise 1.
                Recovery stops at maximum energy.
              </p>
              <p>
                A 5-stamina hero in a Villa recovers at 130 energy/hour, so empty to full takes
                about 1.92 hours, or 1.28 hours with Quick Rest. House-assigned heroes cannot deploy
                until removed from the house.
              </p>
              <Note>
                <strong>Current availability:</strong> registration currently uses demo house
                identities. Real XRPL house NFT ownership verification is not connected yet. Do not
                treat demo registration as an on-chain NFT mint or verified ownership.
              </Note>
            </Section>

            <Section id="economy" number={8} title="Minting & economy">
              <p>
                Minting costs <strong>{fmt(MINT_COST)} in-game coins per hero</strong>. Shop allows{" "}
                {MAX_MINT_PER_TX} heroes per purchase at most. Coins are deducted only through a
                validated purchase, and the resulting heroes are added to your roster.
              </p>
              <p>
                Higher power, broader blasts and more concurrent bombs can improve clearing. They do
                not guarantee income: paths, bushes, chest rarity, overkill, skill rolls and time
                spent resting all change results. Houses reduce rest time rather than increasing
                base chest payouts.
              </p>
              <Note>
                <strong>No guaranteed return.</strong> Earlier balance estimates were projections,
                not measured income promises. There is no fixed number of days to earn back a mint,
                no fixed payout per map and no documented guaranteed coin-to-XRP conversion.
              </Note>
              <p>
                <strong>Wallet status:</strong> the Wallet window includes deposit details,
                withdrawal requests and history. Automatic deposit crediting and on-chain withdrawal
                payouts still require their payment services to be connected. A queued request is
                not a completed wallet payment. Do not send funds expecting automatic credit until
                deposits are confirmed open.
              </p>
            </Section>

            <Section id="marketplace" number={9} title="Marketplace">
              <p>
                Heroes can be listed for sale from their menu. A listed hero is removed from active
                mining. Purchases use in-game coins and require a confirmation. The hero transfers
                immediately when the purchase succeeds; there is no timed hold or separate wallet payment.
              </p>
              <p>
                A <strong>5% market fee is burned</strong> from the listed price. The seller receives
                the remainder, and the buyer pays no extra fee. The burn rounds up to a whole coin:
                a 500-coin sale burns 25 coins and credits the seller 475 coins. Sellers can cancel until sold.
              </p>
              <Note>
                Each purchase and sale appears in Account history with before/after balances and
                the burned fee. If another buyer purchases first, no coins are deducted from you.
                Deposits and withdrawals remain separate wallet operations.
              </Note>
            </Section>

            <Section id="profile" number={10} title="Progress & profile">
              <p>
                Profile records player XP, level, gold claimed and destroyed-chest counts, including
                each rarity. Destroying a chest earns <strong>XP equal to its full base HP</strong>,
                credited once when destruction is accepted. Partial damage and bushes do not award
                chest XP.
              </p>
              <p>
                Cumulative XP needed for player level N is <strong>(N − 1)² × 1,000</strong>.
              </p>
              <DataTable
                label="Player level experience thresholds"
                headers={["Player level", "Total XP required"]}
                rows={[1, 2, 3, 4, 5, 10].map((n) => [n, fmt(xpForLevel(n))])}
              />
              <p>
                Equip eligible avatars and backgrounds through Profile. Cosmetics are gated by
                player level and do not change combat stats. Partnership slots are reserved and
                cannot be equipped. Your editable username is your display name and must be unique
                without regard to letter case.
              </p>
              <p>
                Referral links apply when a new account is created. The Referral window shows the
                referred-player count; no referral reward is currently documented. Leaderboard
                rankings are paginated in groups of 100 players.
              </p>
            </Section>

            <Section id="saving" number={11} title="Saving & fair play">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-1 size-5 shrink-0 text-success" />
                <p>
                  The game checks progress against your wallet session and saved stage. Coins, chest
                  destruction and accepted partial chest damage are stored in the database, not
                  trusted from a browser balance or local HP backup.
                </p>
              </div>
              <p>
                During play, progress syncs on a short cycle, approximately every 4 seconds.
                Confirmed partial chest HP is restored after refresh. The save indicator
                distinguishes saving, saved progress and failed saves that will retry.
              </p>
              <Note>
                A sudden refresh, closed tab or interrupted connection may lose hits that have not
                yet been confirmed. Wait for “Progress saved” before leaving. Failed saves are
                retried, but closing the browser is not a guarantee that a final save will finish.
              </Note>
              <p>
                <strong>One active mining session per player.</strong> Opening Play elsewhere
                supersedes the older session; the old game stops when detected. A same-browser
                notice and periodic session checks help prevent duplicate farming. Switching tabs is
                not a way to multiply rewards.
              </p>
              <p>
                Accepted damage cannot heal a chest, completed chests cannot pay twice, and
                old-stage progress cannot overwrite a new stage. Energy recovery and deployment
                limits are also checked against saved state.
              </p>
            </Section>

            <Section id="faq" number={12} title="Questions & answers">
              <Accordion type="multiple" className="text-foreground">
                {(
                  [
                    [
                      "Where are the sound controls?",
                      "Open the account menu and choose Audio settings. Overall volume controls all game audio; Bomb effects adjusts explosions within that level. You can mute everything or test a bomb sound. Your preferences are saved on this device.",
                    ],
                    [
                      "Why can’t I deploy a hero?",
                      `Check that it has at least ${MIN_DEPLOY_ENERGY_FRACTION * 100}% energy, is not resting in a house or listed for sale, and that fewer than ${MAX_ON_MAP} heroes are already on the map. A superseded game session must also be reopened.`,
                    ],
                    [
                      "Why did a damaged chest come back with more HP?",
                      "Only confirmed hits survive refresh. If the last save was still pending or failed, recent hits may be lost. Confirmed partial health is stored in the database; there is no localStorage HP backup.",
                    ],
                    [
                      "Does the game keep earning when I close it?",
                      "No. Active mining needs the running game. Off-map heroes can recover energy while you are away, up to their maximum.",
                    ],
                    [
                      "Why did my coins not increase after a bomb?",
                      "Bushes do not pay coins, and partially damaged chests do not pay yet. Chest rewards are credited on accepted destruction; a pending save can delay the visible confirmed balance.",
                    ],
                    [
                      "Does rarity change the recovery rate?",
                      `No. Natural recovery is ${ENERGY_RECOVERY_PER_HOUR} energy/hour for every rarity. Higher stamina gives a larger pool, which takes longer to refill. Houses and Quick Rest can accelerate recovery.`,
                    ],
                    [
                      "Can I upgrade heroes or trade house NFTs here?",
                      "Heroes can be upgraded up to Level 10. Each upgrade adds one random unmaxed stat point and costs current hero level squared × 5,000 coins. House registration is a demo flow rather than verified on-chain NFT ownership. Marketplace payment settlement still needs its payment service.",
                    ],
                  ] as const
                ).map(([q, a]) => (
                  <AccordionItem key={q} value={q}>
                    <AccordionTrigger className="text-left text-sm">{q}</AccordionTrigger>
                    <AccordionContent className="text-sm leading-7 text-muted-foreground">
                      {a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Section>
            <footer className="wiki-article-footer">
              <span>
                <Check size={14} /> Values follow the current game rules
              </span>
              <a href="#wiki-top">
                Back to top <ArrowUp size={14} />
              </a>
            </footer>
          </article>
        </div>
      </main>
      <footer className="wiki-footer">
        <div>
          <Link to="/">Vexaria</Link>
          <span>A little crew. A world of treasure.</span>
          <span>Player field guide</span>
        </div>
      </footer>
    </div>
  );
}
