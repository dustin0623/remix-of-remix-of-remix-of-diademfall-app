export type MatchOutcome = 'side_1' | 'side_2' | 'draw';

export interface FormationCard {
  instanceId: string;
  cardId: string;
  level: number;
  position: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface LockedTeam {
  playerId: string;
  summonerCardId: string;
  summonerLevel: number;
  formation: FormationCard[];
  calculatedMana: number;
  submissionHash: string;
}

export interface BattleInput {
  matchId: string;
  gameVersion: string;
  engineVersion: string;
  seed: string;
  manaCap: number;
  rulesetIds: string[];
  side1: LockedTeam;
  side2: LockedTeam;
  catalogHash: string;
}

export interface BattleEvent {
  index: number;
  round: number;
  type: string;
  sourceInstanceId?: string;
  targetInstanceId?: string;
  payload: Record<string, unknown>;
}

export interface BattleOutput {
  outcome: MatchOutcome;
  winnerPlayerId: string | null;
  rounds: number;
  finalState: Record<string, unknown>;
  events: BattleEvent[];
  inputHash: string;
  resultHash: string;
}

// The engine must be pure: no Supabase calls, Date.now(), Math.random(), network, or filesystem.
export type ResolveBattle = (input: BattleInput) => BattleOutput;
