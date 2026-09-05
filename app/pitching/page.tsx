"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Game = {
  id: number;
  game_date: string;
  season: number;
  opponent: string;
  our_score: number | null;
  opponent_score: number | null;
  result: string | null;
};

type Player = {
  id: number;
  name: string;
  number: string | number | null;
};

type PitchingStat = {
  id?: number;
  game_id: number;
  player_id: number;
  innings_pitched: number | string | null;
  batters_faced: number | null;
  pitches: number | null;
  hits_allowed: number | null;
  runs_allowed: number | null;
  earned_runs: number | null;
  walks: number | null;
  strikeouts: number | null;
  hbp: number | null;
  home_runs_allowed: number | null;
  wild_pitches: number | null;
  wins: number | null;
  losses: number | null;
  saves: number | null;
};

type OpponentQuality = "strong" | "average" | "weak";
type JamResult = "success" | "partial" | "failure";
type ScoreSituation =
  | "tied"
  | "lead1"
  | "lead2to3"
  | "trail1"
  | "trail2to3"
  | "blowout";
type OutNeed = "finish" | "one" | "multi";
type ScenarioKey =
  | "tightFresh"
  | "runnersOn"
  | "lateLead"
  | "multiInning"
  | "blowout";

type JamAppearance = {
  gameId: number;
  playerId: number;
  inheritedRunners: number;
  // Raw number of inherited runners that crossed the plate while this reliever was in.
  inheritedRunnersScored: number;
  // Subset of inheritedRunnersScored that scored directly because of a defensive error.
  // These are shown in the log, but are removed from the pitcher's jam-performance penalty.
  inheritedRunnersScoredOnError: number;
  outsAtEntry: number;
  result: JamResult;
  note: string;
};

/*
  CURATED RUNNERS-ON HISTORY

  Box-score pitcher attribution controls whenever it conflicts with the
  GameChanger play-by-play. The two manual corrections discussed were:

  - 6/30 vs Yardgoats: Quinlan entered immediately after Cary allowed
    Hogan's single. Runners were on 1st and 3rd with 0 outs.
  - 7/13 vs Thunder: Cary entered with the bases loaded and 2 outs and
    escaped the jam. Quinlan's four-walk final inning was his own clean-
    inning appearance, so it is NOT treated as an inherited-runner entry.
  - 7/20 vs Vipers: three inherited runners crossed while Cary pitched,
    but the third was error-aided by a shortstop error. The log preserves all three
    raw runs while the jam model charges Cary with only two. The same error-aided adjustment is applied to the 5/26 Degens appearance, where a defensive error prolonged the inning before the third inherited runner scored.
  - 8/30 vs Athletics: manual correction. Cary entered mid-inning with the
    bases loaded and 0 outs after Stanton had already allowed a run. Two of the
    three inherited runners scored and one was stranded. This replaces the
    earlier automated clean-inning attribution for Cary.
*/
const JAM_APPEARANCES: JamAppearance[] = [
  {
    gameId: 3,
    playerId: 7,
    inheritedRunners: 3,
    inheritedRunnersScored: 3,
    inheritedRunnersScoredOnError: 1,
    outsAtEntry: 1,
    result: "partial",
    note: "Entered with bases loaded and 1 out. Two inherited runners scored on a single; a defensive error prolonged the inning and the third inherited runner later scored. That error-aided run is excluded from Cary's jam penalty.",
  },
  {
    gameId: 9,
    playerId: 15,
    inheritedRunners: 2,
    inheritedRunnersScored: 1,
    inheritedRunnersScoredOnError: 0,
    outsAtEntry: 0,
    result: "partial",
    note: "Entered after Cary allowed Hogan's single; runners on 1st and 3rd with 0 outs. One inherited runner scored.",
  },
  {
    gameId: 11,
    playerId: 7,
    inheritedRunners: 3,
    inheritedRunnersScored: 0,
    inheritedRunnersScoredOnError: 0,
    outsAtEntry: 2,
    result: "success",
    note: "Entered with bases loaded and 2 outs and escaped the inning.",
  },
  {
    gameId: 12,
    playerId: 7,
    inheritedRunners: 3,
    inheritedRunnersScored: 3,
    inheritedRunnersScoredOnError: 1,
    outsAtEntry: 1,
    result: "partial",
    note: "Entered with bases loaded and 1 out. Two inherited runners scored on a double; the third was error-aided by a shortstop error. Error-aided run is excluded from Cary's jam penalty.",
  },
  {
    gameId: 13,
    playerId: 6,
    inheritedRunners: 2,
    inheritedRunnersScored: 0,
    inheritedRunnersScoredOnError: 0,
    outsAtEntry: 2,
    result: "success",
    note: "Entered with runners on 1st and 2nd and stranded both.",
  },
  {
    gameId: 13,
    playerId: 13,
    inheritedRunners: 2,
    inheritedRunnersScored: 2,
    inheritedRunnersScoredOnError: 0,
    outsAtEntry: 2,
    result: "failure",
    note: "Entered with runners on 2nd and 3rd; both inherited runners scored.",
  },
  {
    gameId: 15,
    playerId: 7,
    inheritedRunners: 1,
    inheritedRunnersScored: 0,
    inheritedRunnersScoredOnError: 0,
    outsAtEntry: 1,
    result: "success",
    note: "Entered with a runner on 1st and prevented the inherited runner from scoring.",
  },
  {
    gameId: 17,
    playerId: 3,
    inheritedRunners: 1,
    inheritedRunnersScored: 0,
    inheritedRunnersScoredOnError: 0,
    outsAtEntry: 1,
    result: "success",
    note: "Entered with a runner on 1st and stranded him.",
  },
  {
    gameId: 18,
    playerId: 15,
    inheritedRunners: 1,
    inheritedRunnersScored: 0,
    inheritedRunnersScoredOnError: 0,
    outsAtEntry: 2,
    result: "success",
    note: "Entered with a runner on 2nd and stranded him.",
  },
  {
    gameId: 19,
    playerId: 7,
    inheritedRunners: 3,
    inheritedRunnersScored: 2,
    inheritedRunnersScoredOnError: 0,
    outsAtEntry: 0,
    result: "partial",
    note: "Entered mid-inning with bases loaded and 0 outs after Stanton had already allowed a run. Two inherited runners scored and one was stranded.",
  },
];

type PitcherSummary = {
  playerId: number;
  name: string;
  number: string | number | null;

  appearances: number;
  innings: number;
  battersFaced: number;
  pitches: number;
  hits: number;
  runs: number;
  earnedRuns: number;
  walks: number;
  strikeouts: number;
  hbp: number;
  homeRuns: number;

  era: number;
  whip: number;
  kPct: number;
  bbPct: number;
  freePassPct: number;
  kbb: number;
  hitsPerInning: number;
  runsPerInning: number;
  pitchesPerInning: number;

  avgIpPerAppearance: number;
  medianIpAppearance: number;
  maxIpAppearance: number;
  multiInningAppearances: number;
  twoPlusInningAppearances: number;

  adjustedEra: number;
  adjustedWhip: number;
  adjustedKPct: number;
  adjustedBBPct: number;
  adjustedFreePassPct: number;
  adjustedHitsPerInning: number;
  adjustedRunsPerInning: number;
  adjustedHrPerBF: number;
  adjustedKbb: number;
  weightedBF: number;

  runPreventionScore: number;
  whipScore: number;
  strikeoutScore: number;
  controlScore: number;
  hitPreventionScore: number;
  durabilityScore: number;
  hrAvoidanceScore: number;
  kbbScore: number;
  experienceScore: number;
  sampleFactor: number;

  jamAppearances: number;
  successfulJamAppearances: number;
  partialJamAppearances: number;
  failedJamAppearances: number;
  inheritedRunners: number;
  inheritedRunnersScored: number;
  inheritedRunnersScoredOnError: number;
  adjustedInheritedRunnersScored: number;
  adjustedInheritedRunnersPrevented: number;
  jamHistoryScore: number;

  starterScore: number;
  tightFreshScore: number;
  runnersOnScore: number;
  lateLeadScore: number;
  multiInningScore: number;
  blowoutScore: number;
};

const QUALITY_MULTIPLIERS: Record<OpponentQuality, number> = {
  strong: 1.25,
  average: 1.0,
  weak: 0.75,
};

const n = (value: number | null | undefined) => Number(value ?? 0);

function num(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function decimal(value: number, digits = 2) {
  if (!Number.isFinite(value)) return "0.00";
  return value.toFixed(digits);
}

function percent(value: number) {
  if (!Number.isFinite(value)) return "0.0%";
  return `${(value * 100).toFixed(1)}%`;
}

function score100(value: number) {
  if (!Number.isFinite(value)) return "0";
  return Math.round(value * 100).toString();
}

function dateLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString();
}

function daysBetween(later: string, earlier: string) {
  const a = new Date(`${later}T12:00:00`).getTime();
  const b = new Date(`${earlier}T12:00:00`).getTime();
  return Math.max(0, Math.round((a - b) / 86400000));
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function recencyMultiplier(gameDate: string, latestGameDate: string) {
  const days = daysBetween(latestGameDate, gameDate);
  if (days <= 30) return 1.0;
  if (days <= 60) return 0.82;
  if (days <= 90) return 0.68;
  return 0.55;
}

function qualityLabel(value: OpponentQuality) {
  if (value === "strong") return "Strong";
  if (value === "weak") return "Weak";
  return "Average";
}

function qualityClasses(value: OpponentQuality, selected: OpponentQuality) {
  const active = value === selected;
  if (!active) {
    return "border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600 hover:text-slate-200";
  }
  if (value === "strong") {
    return "border-red-500/60 bg-red-500/15 text-red-300";
  }
  if (value === "weak") {
    return "border-sky-500/60 bg-sky-500/15 text-sky-300";
  }
  return "border-amber-500/60 bg-amber-500/15 text-amber-200";
}

function getSuggestedQuality(games: Game[], opponent: string): OpponentQuality {
  const opponentGames = games.filter((game) => game.opponent === opponent);
  if (opponentGames.length === 0) return "average";

  const opponentWins = opponentGames.filter((game) => game.result === "L").length;
  const winPct = opponentWins / opponentGames.length;
  const avgOpponentRunDiff =
    opponentGames.reduce(
      (sum, game) => sum + (n(game.opponent_score) - n(game.our_score)),
      0
    ) / opponentGames.length;

  if (winPct >= 0.67 || avgOpponentRunDiff >= 2.5) return "strong";
  if (winPct <= 0.33 || avgOpponentRunDiff <= -3.5) return "weak";
  return "average";
}

function pitcherLabel(pitcher: PitcherSummary | null) {
  if (!pitcher) return "—";
  return `${pitcher.number ? `#${pitcher.number} ` : ""}${pitcher.name}`;
}

function workloadLabel(pitcher: PitcherSummary) {
  if (pitcher.maxIpAppearance < 1.5) return "Usually 1 inning or less";
  if (pitcher.twoPlusInningAppearances >= 3 || pitcher.medianIpAppearance >= 2) {
    const high = Math.min(4, Math.max(2, Math.round(pitcher.maxIpAppearance)));
    return `Usually 1–${high} innings`;
  }
  if (pitcher.multiInningAppearances >= 2) return "Usually 1–2 innings";
  return "Usually about 1 inning";
}

function scenarioName(key: ScenarioKey) {
  if (key === "runnersOn") return "Tight game · runners on";
  if (key === "lateLead") return "Protecting a late lead";
  if (key === "multiInning") return "Need multiple innings";
  if (key === "blowout") return "Blowout / low leverage";
  return "Tight game · fresh inning";
}

function scenarioDescription(key: ScenarioKey) {
  if (key === "runnersOn") {
    return "Prioritizes repeated successful jam escapes, then swing-and-miss, control and traffic prevention.";
  }
  if (key === "lateLead") {
    return "Prioritizes strikeouts, control, WHIP and limiting one-baserunner damage late in the game.";
  }
  if (key === "multiInning") {
    return "Prioritizes pitchers who have actually demonstrated multi-inning workload plus solid run prevention.";
  }
  if (key === "blowout") {
    return "Preserves top leverage arms while favoring available pitchers with enough experience and workload to absorb outs.";
  }
  return "Best bullpen option when the inning starts clean and the game is still close.";
}

function getScenarioScore(pitcher: PitcherSummary, key: ScenarioKey) {
  if (key === "runnersOn") return pitcher.runnersOnScore;
  if (key === "lateLead") return pitcher.lateLeadScore;
  if (key === "multiInning") return pitcher.multiInningScore;
  if (key === "blowout") return pitcher.blowoutScore;
  return pitcher.tightFreshScore;
}

function DepthChart({
  title,
  description,
  pitchers,
  scenario,
}: {
  title: string;
  description: string;
  pitchers: PitcherSummary[];
  scenario: ScenarioKey;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>

      <div className="mt-4 space-y-2">
        {pitchers.slice(0, 5).map((pitcher, index) => (
          <div
            key={`${scenario}-${pitcher.playerId}`}
            className="flex items-center justify-between gap-4 rounded-xl bg-slate-950 px-4 py-3"
          >
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-black text-slate-500">#{index + 1}</span>
                <span className="truncate font-semibold text-white">{pitcherLabel(pitcher)}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {scenario === "runnersOn"
                  ? `${pitcher.successfulJamAppearances} jam wins · ${pitcher.partialJamAppearances} partial · ${pitcher.adjustedInheritedRunnersPrevented}/${pitcher.inheritedRunners} adjusted IR prevented`
                  : scenario === "multiInning"
                  ? `${pitcher.twoPlusInningAppearances} appearances of 2+ IP · max ${decimal(pitcher.maxIpAppearance, 1)} IP`
                  : `${decimal(pitcher.adjustedEra)} adj. ERA · ${decimal(pitcher.adjustedWhip)} adj. WHIP · ${pitcher.appearances} app`}
              </div>
            </div>
            <div className="shrink-0 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-center">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">Score</div>
              <div className="text-lg font-black">{score100(getScenarioScore(pitcher, scenario))}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PitchingOptimizerPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [pitchingStats, setPitchingStats] = useState<PitchingStat[]>([]);

  const [selectedGameIds, setSelectedGameIds] = useState<number[]>([]);
  const [availablePitcherIds, setAvailablePitcherIds] = useState<number[]>([]);
  const [qualityByGame, setQualityByGame] = useState<Record<number, OpponentQuality>>({});
  const [minBF, setMinBF] = useState(6);

  const [inning, setInning] = useState(5);
  const [scoreSituation, setScoreSituation] = useState<ScoreSituation>("tied");
  const [runners, setRunners] = useState(0);
  const [outs, setOuts] = useState(0);
  const [outNeed, setOutNeed] = useState<OutNeed>("one");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const [
        { data: gameData, error: gameError },
        { data: playerData, error: playerError },
        { data: pitchingData, error: pitchingError },
      ] = await Promise.all([
        supabase
          .from("games")
          .select("id, game_date, season, opponent, our_score, opponent_score, result")
          .order("game_date", { ascending: true }),
        supabase.from("players").select("id, name, number").order("name", { ascending: true }),
        supabase
          .from("pitching_stats")
          .select(
            "id, game_id, player_id, innings_pitched, batters_faced, pitches, hits_allowed, runs_allowed, earned_runs, walks, strikeouts, hbp, home_runs_allowed, wild_pitches, wins, losses, saves"
          ),
      ]);

      if (gameError || playerError || pitchingError) {
        setError(
          gameError?.message ||
            playerError?.message ||
            pitchingError?.message ||
            "Unable to load pitching data."
        );
        setLoading(false);
        return;
      }

      const loadedGames = (gameData ?? []) as Game[];
      const loadedPlayers = (playerData ?? []) as Player[];
      const loadedPitching = (pitchingData ?? []) as PitchingStat[];

      setGames(loadedGames);
      setPlayers(loadedPlayers);
      setPitchingStats(loadedPitching);
      setSelectedGameIds(loadedGames.map((game) => game.id));
      setAvailablePitcherIds(Array.from(new Set(loadedPitching.map((row) => row.player_id))));

      const initialQuality: Record<number, OpponentQuality> = {};
      loadedGames.forEach((game) => {
        initialQuality[game.id] = getSuggestedQuality(loadedGames, game.opponent);
      });
      setQualityByGame(initialQuality);
      setLoading(false);
    }

    loadData();
  }, []);

  const latestGameDate = useMemo(() => {
    if (games.length === 0) return "";
    return [...games].map((game) => game.game_date).sort().at(-1) ?? "";
  }, [games]);

  const gameMap = useMemo(() => new Map(games.map((game) => [game.id, game])), [games]);
  const playerMap = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);

  const pitcherIds = useMemo(
    () => Array.from(new Set(pitchingStats.map((row) => row.player_id))),
    [pitchingStats]
  );

  const pitchers = useMemo(
    () => players.filter((player) => pitcherIds.includes(player.id)),
    [players, pitcherIds]
  );

  const pitcherSummaries = useMemo(() => {
    return pitchers.map((player): PitcherSummary => {
      const rows = pitchingStats.filter(
        (row) => row.player_id === player.id && selectedGameIds.includes(row.game_id)
      );

      let innings = 0;
      let battersFaced = 0;
      let pitches = 0;
      let hits = 0;
      let runs = 0;
      let earnedRuns = 0;
      let walks = 0;
      let strikeouts = 0;
      let hbp = 0;
      let homeRuns = 0;

      let weightedIP = 0;
      let weightedBF = 0;
      let weightedHits = 0;
      let weightedRuns = 0;
      let weightedER = 0;
      let weightedWalks = 0;
      let weightedK = 0;
      let weightedHBP = 0;
      let weightedHR = 0;

      const ipAppearances: number[] = [];

      rows.forEach((row) => {
        const ip = num(row.innings_pitched);
        const bf = n(row.batters_faced);
        const game = gameMap.get(row.game_id);
        const recency = game && latestGameDate ? recencyMultiplier(game.game_date, latestGameDate) : 1;
        const quality = qualityByGame[row.game_id] ?? "average";
        const weight = recency * QUALITY_MULTIPLIERS[quality];

        innings += ip;
        battersFaced += bf;
        pitches += n(row.pitches);
        hits += n(row.hits_allowed);
        runs += n(row.runs_allowed);
        earnedRuns += n(row.earned_runs);
        walks += n(row.walks);
        strikeouts += n(row.strikeouts);
        hbp += n(row.hbp);
        homeRuns += n(row.home_runs_allowed);
        ipAppearances.push(ip);

        weightedIP += ip * weight;
        weightedBF += bf * weight;
        weightedHits += n(row.hits_allowed) * weight;
        weightedRuns += n(row.runs_allowed) * weight;
        weightedER += n(row.earned_runs) * weight;
        weightedWalks += n(row.walks) * weight;
        weightedK += n(row.strikeouts) * weight;
        weightedHBP += n(row.hbp) * weight;
        weightedHR += n(row.home_runs_allowed) * weight;
      });

      const appearances = rows.length;
      const avgIpPerAppearance = appearances > 0 ? innings / appearances : 0;
      const medianIpAppearance = median(ipAppearances);
      const maxIpAppearance = ipAppearances.length > 0 ? Math.max(...ipAppearances) : 0;
      const multiInningAppearances = ipAppearances.filter((ip) => ip > 1).length;
      const twoPlusInningAppearances = ipAppearances.filter((ip) => ip >= 2).length;

      const era = innings > 0 ? (earnedRuns * 9) / innings : 0;
      const whip = innings > 0 ? (walks + hits) / innings : 0;
      const kPct = battersFaced > 0 ? strikeouts / battersFaced : 0;
      const bbPct = battersFaced > 0 ? walks / battersFaced : 0;
      const freePassPct = battersFaced > 0 ? (walks + hbp) / battersFaced : 0;
      const kbb = walks > 0 ? strikeouts / walks : strikeouts;
      const hitsPerInning = innings > 0 ? hits / innings : 0;
      const runsPerInning = innings > 0 ? runs / innings : 0;
      const pitchesPerInning = innings > 0 ? pitches / innings : 0;

      const adjustedEra = weightedIP > 0 ? (weightedER * 9) / weightedIP : 0;
      const adjustedWhip = weightedIP > 0 ? (weightedWalks + weightedHits) / weightedIP : 0;
      const adjustedKPct = weightedBF > 0 ? weightedK / weightedBF : 0;
      const adjustedBBPct = weightedBF > 0 ? weightedWalks / weightedBF : 0;
      const adjustedFreePassPct =
        weightedBF > 0 ? (weightedWalks + weightedHBP) / weightedBF : 0;
      const adjustedHitsPerInning = weightedIP > 0 ? weightedHits / weightedIP : 0;
      const adjustedRunsPerInning = weightedIP > 0 ? weightedRuns / weightedIP : 0;
      const adjustedHrPerBF = weightedBF > 0 ? weightedHR / weightedBF : 0;
      const adjustedKbb = weightedWalks > 0 ? weightedK / weightedWalks : weightedK;

      const runPreventionScore = clamp(1 - adjustedEra / 10);
      const whipScore = clamp((2.0 - adjustedWhip) / 1.4);
      const strikeoutScore = clamp(adjustedKPct / 0.35);
      const controlScore = clamp(1 - adjustedFreePassPct / 0.18);
      const hitPreventionScore = clamp(1 - adjustedHitsPerInning / 1.4);
      const hrAvoidanceScore = clamp(1 - adjustedHrPerBF / 0.05);
      const kbbScore = clamp(adjustedKbb / 5);

      const workloadVolume = clamp(twoPlusInningAppearances / 4);
      const workloadLength = clamp(medianIpAppearance / 3);
      const workloadCeiling = clamp(maxIpAppearance / 5);
      const durabilityScore =
        workloadVolume * 0.45 + workloadLength * 0.35 + workloadCeiling * 0.2;

      /*
        Experience deliberately matters more in v3. A pitcher with one tiny
        appearance can still appear on a depth chart, but should not leap to
        the top solely because of a great rate stat or one successful jam.
      */
      const bfExperience = clamp(weightedBF / 50);
      const appearanceExperience = clamp(appearances / 6);
      const experienceScore = bfExperience * 0.65 + appearanceExperience * 0.35;
      const sampleFactor = bfExperience;
      const normalConfidence = 0.58 + 0.42 * experienceScore;
      const leverageConfidence = 0.45 + 0.55 * experienceScore;

      const jamRows = JAM_APPEARANCES.filter(
        (jam) => jam.playerId === player.id && selectedGameIds.includes(jam.gameId)
      );

      let successfulJamAppearances = 0;
      let partialJamAppearances = 0;
      let failedJamAppearances = 0;
      let inheritedRunners = 0;
      let inheritedRunnersScored = 0;
      let inheritedRunnersScoredOnError = 0;
      let adjustedInheritedRunnersScored = 0;
      let weightedSuccessfulJams = 0;
      let weightedPartialJams = 0;
      let weightedFailedJams = 0;
      let weightedDifficultyWins = 0;

      jamRows.forEach((jam) => {
        const game = gameMap.get(jam.gameId);
        const recency = game && latestGameDate ? recencyMultiplier(game.game_date, latestGameDate) : 1;
        const quality = qualityByGame[jam.gameId] ?? "average";
        const weight = recency * QUALITY_MULTIPLIERS[quality];
        const difficulty = jam.inheritedRunners + (jam.outsAtEntry === 0 ? 1 : jam.outsAtEntry === 1 ? 0.5 : 0);

        const adjustedScored = Math.max(
          0,
          jam.inheritedRunnersScored - jam.inheritedRunnersScoredOnError
        );

        inheritedRunners += jam.inheritedRunners;
        inheritedRunnersScored += jam.inheritedRunnersScored;
        inheritedRunnersScoredOnError += jam.inheritedRunnersScoredOnError;
        adjustedInheritedRunnersScored += adjustedScored;

        if (jam.result === "success") {
          successfulJamAppearances += 1;
          weightedSuccessfulJams += weight;
          weightedDifficultyWins += difficulty * weight;
        } else if (jam.result === "partial") {
          partialJamAppearances += 1;
          weightedPartialJams += weight;
        } else {
          failedJamAppearances += 1;
          weightedFailedJams += weight;
        }
      });

      const jamAppearances = jamRows.length;
      const adjustedInheritedRunnersPrevented = Math.max(
        0,
        inheritedRunners - adjustedInheritedRunnersScored
      );

      /*
        JAM HISTORY v3 — SUCCESS COUNT FIRST

        60% repeated successful jam appearances
        20% difficulty of successful escapes
        10% partial successes
        10% failure penalty

        This intentionally does NOT reward a pitcher just for being 1-for-1.
        Repeated successful entries are the main path to a high score.
      */
      const successVolume = clamp(weightedSuccessfulJams / 3.5);
      const successDifficulty = clamp(weightedDifficultyWins / 8);
      const partialCredit = clamp(weightedPartialJams / 3);
      const failurePenalty = clamp(weightedFailedJams / 3);
      const jamHistoryScore = clamp(
        successVolume * 0.6 +
          successDifficulty * 0.2 +
          partialCredit * 0.1 +
          (1 - failurePenalty) * 0.1
      );

      /* STARTER: performance plus actually demonstrated length. */
      const starterRaw =
        runPreventionScore * 0.25 +
        whipScore * 0.2 +
        durabilityScore * 0.24 +
        controlScore * 0.12 +
        hitPreventionScore * 0.09 +
        strikeoutScore * 0.08 +
        experienceScore * 0.02;

      /* Tight game, clean inning. */
      const tightFreshRaw =
        whipScore * 0.22 +
        controlScore * 0.2 +
        strikeoutScore * 0.18 +
        runPreventionScore * 0.15 +
        hitPreventionScore * 0.1 +
        hrAvoidanceScore * 0.06 +
        kbbScore * 0.05 +
        experienceScore * 0.04;

      /* Runners on: proven successful jam volume is the biggest differentiator. */
      const runnersOnRaw =
        jamHistoryScore * 0.4 +
        strikeoutScore * 0.18 +
        controlScore * 0.15 +
        whipScore * 0.1 +
        hitPreventionScore * 0.07 +
        runPreventionScore * 0.04 +
        kbbScore * 0.03 +
        experienceScore * 0.03;

      /* Late lead: miss bats, avoid walks and avoid traffic. */
      const lateLeadRaw =
        strikeoutScore * 0.28 +
        controlScore * 0.22 +
        whipScore * 0.2 +
        runPreventionScore * 0.1 +
        hitPreventionScore * 0.07 +
        kbbScore * 0.07 +
        hrAvoidanceScore * 0.04 +
        experienceScore * 0.02;

      /* Multi-inning bridge: actual history of length is critical. */
      const multiInningRaw =
        durabilityScore * 0.34 +
        runPreventionScore * 0.18 +
        whipScore * 0.16 +
        controlScore * 0.11 +
        hitPreventionScore * 0.08 +
        strikeoutScore * 0.07 +
        experienceScore * 0.06;

      /* Blowout: preserve elite leverage arms and favor reliable inning coverage. */
      const lowLeverageSkill =
        durabilityScore * 0.32 +
        experienceScore * 0.24 +
        controlScore * 0.16 +
        runPreventionScore * 0.12 +
        whipScore * 0.1 +
        hitPreventionScore * 0.06;

      // High-leverage talent is lightly subtracted so a blowout doesn't burn the best arm first.
      const leverageTalent = clamp((runnersOnRaw + lateLeadRaw) / 2);
      const blowoutRaw = clamp(lowLeverageSkill * 0.9 + (1 - leverageTalent) * 0.1);

      return {
        playerId: player.id,
        name: player.name,
        number: player.number,
        appearances,
        innings,
        battersFaced,
        pitches,
        hits,
        runs,
        earnedRuns,
        walks,
        strikeouts,
        hbp,
        homeRuns,
        era,
        whip,
        kPct,
        bbPct,
        freePassPct,
        kbb,
        hitsPerInning,
        runsPerInning,
        pitchesPerInning,
        avgIpPerAppearance,
        medianIpAppearance,
        maxIpAppearance,
        multiInningAppearances,
        twoPlusInningAppearances,
        adjustedEra,
        adjustedWhip,
        adjustedKPct,
        adjustedBBPct,
        adjustedFreePassPct,
        adjustedHitsPerInning,
        adjustedRunsPerInning,
        adjustedHrPerBF,
        adjustedKbb,
        weightedBF,
        runPreventionScore,
        whipScore,
        strikeoutScore,
        controlScore,
        hitPreventionScore,
        durabilityScore,
        hrAvoidanceScore,
        kbbScore,
        experienceScore,
        sampleFactor,
        jamAppearances,
        successfulJamAppearances,
        partialJamAppearances,
        failedJamAppearances,
        inheritedRunners,
        inheritedRunnersScored,
        inheritedRunnersScoredOnError,
        adjustedInheritedRunnersScored,
        adjustedInheritedRunnersPrevented,
        jamHistoryScore,
        starterScore: starterRaw * normalConfidence,
        tightFreshScore: tightFreshRaw * leverageConfidence,
        runnersOnScore: runnersOnRaw * leverageConfidence,
        lateLeadScore: lateLeadRaw * leverageConfidence,
        multiInningScore: multiInningRaw * normalConfidence,
        blowoutScore: blowoutRaw * normalConfidence,
      };
    });
  }, [pitchers, pitchingStats, selectedGameIds, gameMap, latestGameDate, qualityByGame]);

  const eligiblePitchers = useMemo(
    () =>
      pitcherSummaries.filter(
        (pitcher) =>
          availablePitcherIds.includes(pitcher.playerId) && pitcher.battersFaced >= minBF
      ),
    [pitcherSummaries, availablePitcherIds, minBF]
  );

  const starterDepth = useMemo(
    () => [...eligiblePitchers].sort((a, b) => b.starterScore - a.starterScore),
    [eligiblePitchers]
  );

  const scenarioDepth = useMemo(() => {
    const sortBy = (key: ScenarioKey) =>
      [...eligiblePitchers].sort((a, b) => getScenarioScore(b, key) - getScenarioScore(a, key));

    return {
      tightFresh: sortBy("tightFresh"),
      runnersOn: sortBy("runnersOn"),
      lateLead: sortBy("lateLead"),
      multiInning: sortBy("multiInning"),
      blowout: sortBy("blowout"),
    };
  }, [eligiblePitchers]);

  const recommendedScenario = useMemo<ScenarioKey>(() => {
    const protectingLead = scoreSituation === "lead1" || scoreSituation === "lead2to3";
    const closeGame = scoreSituation !== "blowout";

    if (runners > 0 && closeGame) return "runnersOn";
    if (outNeed === "multi") return "multiInning";
    if (inning >= 6 && protectingLead) return "lateLead";
    if (scoreSituation === "blowout") return "blowout";
    return "tightFresh";
  }, [inning, scoreSituation, runners, outNeed]);

  const currentDepth = scenarioDepth[recommendedScenario];

  const situationalDepth = useMemo(() => {
    return currentDepth
      .map((pitcher) => {
        let score = getScenarioScore(pitcher, recommendedScenario);

        // Fine-tune within the chosen scenario based on the live game state.
        if (recommendedScenario === "runnersOn") {
          const runnerPressure = runners / 3;
          const outPressure = outs === 0 ? 1 : outs === 1 ? 0.6 : 0.3;
          score =
            score * 0.82 +
            pitcher.jamHistoryScore * 0.1 * runnerPressure +
            pitcher.strikeoutScore * 0.05 * outPressure +
            pitcher.controlScore * 0.03;
        }

        if (outNeed === "multi") {
          score = score * 0.85 + pitcher.durabilityScore * 0.15;
        } else if (outNeed === "finish") {
          score = score * 0.9 + pitcher.strikeoutScore * 0.06 + pitcher.controlScore * 0.04;
        }

        return { pitcher, score: clamp(score) };
      })
      .sort((a, b) => b.score - a.score);
  }, [currentDepth, recommendedScenario, runners, outs, outNeed]);

  const bestStarter = starterDepth[0] ?? null;

  function toggleGame(id: number) {
    setSelectedGameIds((current) =>
      current.includes(id) ? current.filter((gameId) => gameId !== id) : [...current, id]
    );
  }

  function togglePitcher(id: number) {
    setAvailablePitcherIds((current) =>
      current.includes(id)
        ? current.filter((playerId) => playerId !== id)
        : [...current, id]
    );
  }

  function resetOpponentQuality() {
    const next: Record<number, OpponentQuality> = {};
    games.forEach((game) => {
      next[game.id] = getSuggestedQuality(games, game.opponent);
    });
    setQualityByGame(next);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        Loading Iron Horse Pitching Optimizer...
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        <h1 className="text-3xl font-bold">Iron Horse Pitching Optimizer</h1>
        <p className="mt-6 text-red-400">{error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl p-6 md:p-10">
        <div className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Iron Horse Baseball · 2026
            </div>

            <nav className="flex rounded-xl border border-slate-800 bg-slate-900 p-1 text-sm">
              <a
                href="/"
                className="rounded-lg px-4 py-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                Run Maximizer
              </a>
              <a href="/pitching" className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white">
                Pitching Optimizer
              </a>
            </nav>
          </div>

          <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
            Iron Horse
            <span className="block text-slate-300">Situational Pitching Optimizer</span>
          </h1>

          <p className="mt-4 max-w-4xl text-lg leading-8 text-slate-400">
            Start with the best starter, then make the bullpen decision from the game state. Pitchers can rank on multiple depth charts, and workload recommendations are anchored to what they have actually done this season.
          </p>
        </div>

        {/* BEST STARTER */}
        <section className="rounded-2xl border border-emerald-500/25 bg-slate-900 p-6">
          <div className="text-xs font-semibold uppercase tracking-widest text-emerald-400">1 · Start here</div>
          <div className="mt-2 flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-black">Best Starter</h2>
              {bestStarter ? (
                <>
                  <div className="mt-3 text-3xl font-black text-white">{pitcherLabel(bestStarter)}</div>
                  <div className="mt-2 font-semibold text-emerald-300">{workloadLabel(bestStarter)}</div>
                  <p className="mt-3 text-sm text-slate-400">
                    {decimal(bestStarter.adjustedEra)} adj. ERA · {decimal(bestStarter.adjustedWhip)} adj. WHIP · {decimal(bestStarter.medianIpAppearance, 1)} median IP/app · {bestStarter.twoPlusInningAppearances} appearances of 2+ IP
                  </p>
                </>
              ) : (
                <p className="mt-3 text-slate-400">No eligible pitcher selected.</p>
              )}
            </div>

            {bestStarter && (
              <div className="rounded-xl border border-slate-700 bg-slate-950 px-6 py-4 text-center">
                <div className="text-xs uppercase tracking-widest text-slate-500">Starter score</div>
                <div className="mt-1 text-4xl font-black">{score100(bestStarter.starterScore)}</div>
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-2 md:grid-cols-4">
            {starterDepth.slice(0, 4).map((pitcher, index) => (
              <div key={`starter-${pitcher.playerId}`} className="rounded-xl bg-slate-950 px-4 py-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Starter #{index + 1}</div>
                <div className="mt-1 font-semibold text-white">{pitcherLabel(pitcher)}</div>
                <div className="mt-1 text-xs text-slate-500">
                  Score {score100(pitcher.starterScore)} · max {decimal(pitcher.maxIpAppearance, 1)} IP
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* WHO SHOULD PITCH NOW */}
        <section className="mt-6 rounded-2xl border border-sky-500/25 bg-slate-900 p-6">
          <div className="text-xs font-semibold uppercase tracking-widest text-sky-400">2 · If this, then that</div>
          <h2 className="mt-1 text-2xl font-black">Who Should Pitch Now?</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Set the live game state. The optimizer chooses the relevant depth chart and then fine-tunes the order for runners, outs and expected workload.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-5">
            <label className="text-sm text-slate-400">
              Inning
              <select
                value={inning}
                onChange={(e) => setInning(Number(e.target.value))}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              >
                {[1, 2, 3, 4, 5, 6, 7].map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-400">
              Score
              <select
                value={scoreSituation}
                onChange={(e) => setScoreSituation(e.target.value as ScoreSituation)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              >
                <option value="tied">Tied</option>
                <option value="lead1">Lead by 1</option>
                <option value="lead2to3">Lead by 2–3</option>
                <option value="trail1">Trail by 1</option>
                <option value="trail2to3">Trail by 2–3</option>
                <option value="blowout">4+ run game</option>
              </select>
            </label>

            <label className="text-sm text-slate-400">
              Runners on
              <select
                value={runners}
                onChange={(e) => setRunners(Number(e.target.value))}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              >
                <option value={0}>Bases empty</option>
                <option value={1}>1 runner</option>
                <option value={2}>2 runners</option>
                <option value={3}>Bases loaded</option>
              </select>
            </label>

            <label className="text-sm text-slate-400">
              Outs
              <select
                value={outs}
                onChange={(e) => setOuts(Number(e.target.value))}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              >
                <option value={0}>0 outs</option>
                <option value={1}>1 out</option>
                <option value={2}>2 outs</option>
              </select>
            </label>

            <label className="text-sm text-slate-400">
              Need from next pitcher
              <select
                value={outNeed}
                onChange={(e) => setOutNeed(e.target.value as OutNeed)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              >
                <option value="finish">Just finish inning</option>
                <option value="one">About 1 inning</option>
                <option value="multi">2+ innings</option>
              </select>
            </label>
          </div>

          <div className="mt-6 rounded-2xl border border-sky-500/30 bg-slate-950 p-5">
            <div className="text-xs font-bold uppercase tracking-widest text-sky-400">Recommended scenario</div>
            <div className="mt-1 text-xl font-black text-white">{scenarioName(recommendedScenario)}</div>
            <p className="mt-1 text-sm text-slate-400">{scenarioDescription(recommendedScenario)}</p>

            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {situationalDepth.slice(0, 3).map(({ pitcher, score }, index) => (
                <div
                  key={`live-${pitcher.playerId}`}
                  className={`rounded-xl border p-4 ${
                    index === 0
                      ? "border-sky-500/50 bg-sky-500/10"
                      : "border-slate-800 bg-slate-900"
                  }`}
                >
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    {index === 0 ? "Bring in" : `Backup #${index}`}
                  </div>
                  <div className="mt-1 text-xl font-black text-white">{pitcherLabel(pitcher)}</div>
                  <div className="mt-2 text-sm text-slate-400">
                    Situation score <strong className="text-white">{score100(score)}</strong>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {workloadLabel(pitcher)} · {pitcher.appearances} appearances
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* DEPTH CHARTS */}
        <section className="mt-6">
          <div className="mb-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Scenario depth charts</div>
            <h2 className="mt-1 text-2xl font-black">Bullpen Decision Tree</h2>
            <p className="mt-2 text-sm text-slate-400">
              A pitcher can appear on as many lists as his profile warrants. These are independent rankings, not mutually exclusive bullpen roles.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <DepthChart
              title="Tight Game · Fresh Inning"
              description={scenarioDescription("tightFresh")}
              pitchers={scenarioDepth.tightFresh}
              scenario="tightFresh"
            />
            <DepthChart
              title="Tight Game · Runners On"
              description={scenarioDescription("runnersOn")}
              pitchers={scenarioDepth.runnersOn}
              scenario="runnersOn"
            />
            <DepthChart
              title="Protecting a Late Lead"
              description={scenarioDescription("lateLead")}
              pitchers={scenarioDepth.lateLead}
              scenario="lateLead"
            />
            <DepthChart
              title="Need Multiple Innings"
              description={scenarioDescription("multiInning")}
              pitchers={scenarioDepth.multiInning}
              scenario="multiInning"
            />
            <DepthChart
              title="Blowout / Low Leverage"
              description={scenarioDescription("blowout")}
              pitchers={scenarioDepth.blowout}
              scenario="blowout"
            />
          </div>
        </section>

        {/* FILTERS */}
        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Model inputs</div>
                <h2 className="mt-1 text-xl font-bold">Weight the Competition</h2>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Strong teams count 1.25×, average teams 1.00× and weak teams 0.75×. Recency is also applied automatically.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setSelectedGameIds(games.map((game) => game.id))} className="rounded-lg bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700">All</button>
                <button onClick={() => setSelectedGameIds([])} className="rounded-lg bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700">None</button>
                <button onClick={resetOpponentQuality} className="rounded-lg bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700">Reset Auto</button>
              </div>
            </div>

            <div className="mt-5 max-h-[32rem] space-y-3 overflow-y-auto pr-1">
              {games.map((game) => {
                const quality = qualityByGame[game.id] ?? "average";
                const recency = latestGameDate ? recencyMultiplier(game.game_date, latestGameDate) : 1;
                return (
                  <div key={game.id} className="rounded-xl bg-slate-950 px-4 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <label className="flex cursor-pointer items-center gap-3">
                        <input type="checkbox" checked={selectedGameIds.includes(game.id)} onChange={() => toggleGame(game.id)} className="h-4 w-4" />
                        <div>
                          <div className="font-medium">{game.opponent}</div>
                          <div className="text-xs text-slate-500">{dateLabel(game.game_date)} · Recency {decimal(recency)}×</div>
                        </div>
                      </label>
                      <div className={game.result === "W" ? "font-semibold text-green-400" : game.result === "L" ? "font-semibold text-red-400" : "font-semibold text-slate-300"}>
                        {game.result} {game.our_score}-{game.opponent_score}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(["strong", "average", "weak"] as OpponentQuality[]).map((value) => (
                        <button
                          key={value}
                          onClick={() => setQualityByGame((current) => ({ ...current, [game.id]: value }))}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${qualityClasses(value, quality)}`}
                        >
                          {qualityLabel(value)} {decimal(QUALITY_MULTIPLIERS[value], 2)}×
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Tonight</div>
                <h2 className="mt-1 text-xl font-bold">Available Pitchers</h2>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Uncheck anyone unavailable. All depth charts update immediately.
                </p>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-slate-500">Minimum BF</label>
                <input
                  type="number"
                  min={0}
                  value={minBF}
                  onChange={(e) => setMinBF(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-1 w-24 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {pitchers.map((pitcher) => {
                const summary = pitcherSummaries.find((item) => item.playerId === pitcher.id);
                return (
                  <label key={pitcher.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-slate-950 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={availablePitcherIds.includes(pitcher.id)} onChange={() => togglePitcher(pitcher.id)} className="h-4 w-4" />
                      <div>
                        <div className="font-medium text-white">{pitcher.number ? `#${pitcher.number} ` : ""}{pitcher.name}</div>
                        <div className="text-xs text-slate-500">
                          {summary ? `${summary.appearances} app · ${decimal(summary.innings, 1)} IP · ${decimal(summary.maxIpAppearance, 1)} max IP` : "No selected data"}
                        </div>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </section>

        {/* TRUST BOARD */}
        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Underlying data</div>
          <h2 className="mt-1 text-2xl font-black">Pitcher Trust Board</h2>
          <p className="mt-2 text-sm text-slate-400">
            Scores are role-specific. Experience and demonstrated workload now prevent tiny samples from dominating the rankings.
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[1350px] w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-3">Pitcher</th>
                  <th className="px-3 py-3">App</th>
                  <th className="px-3 py-3">IP</th>
                  <th className="px-3 py-3">Median IP</th>
                  <th className="px-3 py-3">2+ IP App</th>
                  <th className="px-3 py-3">ERA</th>
                  <th className="px-3 py-3">WHIP</th>
                  <th className="px-3 py-3">K%</th>
                  <th className="px-3 py-3">BB%</th>
                  <th className="px-3 py-3">Jam Wins</th>
                  <th className="px-3 py-3">Starter</th>
                  <th className="px-3 py-3">Fresh</th>
                  <th className="px-3 py-3">Runners On</th>
                  <th className="px-3 py-3">Late Lead</th>
                  <th className="px-3 py-3">Multi</th>
                  <th className="px-3 py-3">Blowout</th>
                </tr>
              </thead>
              <tbody>
                {[...eligiblePitchers].sort((a, b) => b.starterScore - a.starterScore).map((pitcher) => (
                  <tr key={`board-${pitcher.playerId}`} className="border-b border-slate-800/70">
                    <td className="whitespace-nowrap px-3 py-4 font-semibold">{pitcherLabel(pitcher)}</td>
                    <td className="px-3 py-4">{pitcher.appearances}</td>
                    <td className="px-3 py-4">{decimal(pitcher.innings, 1)}</td>
                    <td className="px-3 py-4">{decimal(pitcher.medianIpAppearance, 1)}</td>
                    <td className="px-3 py-4">{pitcher.twoPlusInningAppearances}</td>
                    <td className="px-3 py-4">{decimal(pitcher.era)}</td>
                    <td className="px-3 py-4">{decimal(pitcher.whip)}</td>
                    <td className="px-3 py-4">{percent(pitcher.kPct)}</td>
                    <td className="px-3 py-4">{percent(pitcher.bbPct)}</td>
                    <td className="px-3 py-4">{pitcher.successfulJamAppearances}</td>
                    <td className="px-3 py-4">{score100(pitcher.starterScore)}</td>
                    <td className="px-3 py-4">{score100(pitcher.tightFreshScore)}</td>
                    <td className="px-3 py-4">{score100(pitcher.runnersOnScore)}</td>
                    <td className="px-3 py-4">{score100(pitcher.lateLeadScore)}</td>
                    <td className="px-3 py-4">{score100(pitcher.multiInningScore)}</td>
                    <td className="px-3 py-4">{score100(pitcher.blowoutScore)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* JAM LOG */}
        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Proven runners-on history</div>
          <h2 className="mt-1 text-2xl font-black">High-Leverage Relief Log</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            Success count is the main driver. Clean-inning appearances are intentionally excluded. If an inherited runner scores directly because of a defensive error, the raw run remains visible here but is removed from the reliever's jam penalty.
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[1120px] w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Opponent</th>
                  <th className="px-3 py-3">Pitcher</th>
                  <th className="px-3 py-3">Outs</th>
                  <th className="px-3 py-3">IR</th>
                  <th className="px-3 py-3">Raw IR Scored</th>
                  <th className="px-3 py-3">Error-Aided IR</th>
                  <th className="px-3 py-3">Adjusted IR Scored</th>
                  <th className="px-3 py-3">Result</th>
                  <th className="px-3 py-3">Situation</th>
                </tr>
              </thead>
              <tbody>
                {JAM_APPEARANCES.filter((jam) => selectedGameIds.includes(jam.gameId)).map((jam, index) => {
                  const game = gameMap.get(jam.gameId);
                  const player = playerMap.get(jam.playerId);
                  return (
                    <tr key={`${jam.gameId}-${jam.playerId}-${index}`} className="border-b border-slate-800/70">
                      <td className="whitespace-nowrap px-3 py-4">{game ? dateLabel(game.game_date) : `Game ${jam.gameId}`}</td>
                      <td className="px-3 py-4">{game?.opponent ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-4 font-semibold">{player?.number ? `#${player.number} ` : ""}{player?.name ?? `Player ${jam.playerId}`}</td>
                      <td className="px-3 py-4">{jam.outsAtEntry}</td>
                      <td className="px-3 py-4">{jam.inheritedRunners}</td>
                      <td className="px-3 py-4">{jam.inheritedRunnersScored}</td>
                      <td className="px-3 py-4">{jam.inheritedRunnersScoredOnError}</td>
                      <td className="px-3 py-4 font-semibold text-white">
                        {Math.max(0, jam.inheritedRunnersScored - jam.inheritedRunnersScoredOnError)}
                      </td>
                      <td className="px-3 py-4">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold uppercase ${
                          jam.result === "success"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                            : jam.result === "partial"
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                            : "border-red-500/40 bg-red-500/10 text-red-300"
                        }`}>
                          {jam.result}
                        </span>
                      </td>
                      <td className="max-w-xl px-3 py-4 text-slate-400">{jam.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* METHODOLOGY */}
        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Methodology</div>
          <h2 className="mt-1 text-2xl font-black">Pitching Optimizer v3</h2>
          <div className="mt-5 max-w-5xl space-y-4 text-sm leading-7 text-slate-400">
            <p><strong className="text-white">Starter:</strong> chooses the best blend of run prevention, WHIP, control and demonstrated length. Historical multi-inning workload now matters much more than it did in v2.</p>
            <p><strong className="text-white">Tight game, fresh inning:</strong> emphasizes WHIP, control, strikeouts and run prevention. This is the default bridge-reliever ranking.</p>
            <p><strong className="text-white">Tight game, runners on:</strong> puts 40% of the raw score on proven jam history. Jam history is volume-first: repeated successful escapes are much more valuable than a perfect one-appearance rate.</p>
            <p><strong className="text-white">Defensive-error adjustment:</strong> inherited runners that score directly because of a fielding error remain in the raw game log but are excluded from the reliever's adjusted inherited-runner total and jam penalty. The 7/20 Vipers appearance is therefore graded Partial: 3 inherited runners crossed, but only 2 are charged to Cary for this model.</p>
            <p><strong className="text-white">Late lead:</strong> emphasizes strikeouts, control, WHIP and K/BB so the model prefers pitchers least likely to create traffic when protecting a lead.</p>
            <p><strong className="text-white">Multiple innings:</strong> heavily rewards pitchers who have actually gone 2+ innings repeatedly. This prevents the model from assigning three innings to a pitcher who almost never works that long.</p>
            <p><strong className="text-white">Blowout:</strong> favors reliable inning coverage while lightly preserving the highest-leverage arms for another day.</p>
            <p><strong className="text-white">Experience:</strong> every scenario applies a stronger sample-confidence adjustment than v2. Small samples remain visible but are substantially less likely to top a depth chart.</p>
            <p><strong className="text-white">Recency and opponent quality:</strong> appearances are still weighted by recency and opponent strength before the rate metrics are calculated.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
