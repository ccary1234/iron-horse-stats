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
  maxIpAppearance: number;

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
  attendanceScore: number;
  sampleFactor: number;

  overallScore: number;
  starterScore: number;
  reliefScore: number;
  firemanScore: number;
  closerScore: number;
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

/*
  RECENCY MULTIPLIER

  0–30 days   = 1.00x
  31–60 days  = 0.82x
  61–90 days  = 0.68x
  91+ days    = 0.55x

  "Recent" is measured from the latest game in the dataset so the model
  remains internally consistent even if you revisit the app later.
*/
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

function qualityClasses(
  value: OpponentQuality,
  selected: OpponentQuality
) {
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

function roleBadgeClasses(role: string) {
  if (role === "STARTER") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (role === "FIRST RELIEVER") return "border-sky-500/40 bg-sky-500/10 text-sky-300";
  if (role === "CLOSER") return "border-violet-500/40 bg-violet-500/10 text-violet-300";
  return "border-orange-500/40 bg-orange-500/10 text-orange-300";
}

function getSuggestedQuality(games: Game[], opponent: string): OpponentQuality {
  const opponentGames = games.filter((game) => game.opponent === opponent);

  if (opponentGames.length === 0) return "average";

  const opponentWins = opponentGames.filter((game) => game.result === "L").length;
  const winPct = opponentWins / opponentGames.length;

  const avgOpponentRunDiff =
    opponentGames.reduce(
      (sum, game) =>
        sum + (n(game.opponent_score) - n(game.our_score)),
      0
    ) / opponentGames.length;

  // This is only a starting suggestion. Every game remains manually editable.
  if (winPct >= 0.67 || avgOpponentRunDiff >= 2.5) return "strong";
  if (winPct <= 0.33 || avgOpponentRunDiff <= -3.5) return "weak";
  return "average";
}

function buildReason(
  pitcher: PitcherSummary,
  role: "starter" | "relief" | "fireman" | "closer"
) {
  if (role === "starter") {
    return `${decimal(pitcher.adjustedEra)} adj. ERA · ${decimal(
      pitcher.adjustedWhip
    )} adj. WHIP · ${decimal(
      pitcher.avgIpPerAppearance,
      1
    )} IP per appearance`;
  }

  if (role === "relief") {
    return `${percent(pitcher.adjustedKPct)} K · ${percent(
      pitcher.adjustedBBPct
    )} BB · ${decimal(pitcher.adjustedWhip)} adj. WHIP`;
  }

  if (role === "fireman") {
    return `${percent(pitcher.adjustedKPct)} K · ${percent(
      pitcher.adjustedFreePassPct
    )} BB+HBP · ${decimal(
      pitcher.adjustedHitsPerInning,
      2
    )} H/IP`;
  }

  return `${percent(pitcher.adjustedKPct)} K · ${decimal(
    pitcher.adjustedKbb
  )} K/BB · ${decimal(pitcher.adjustedWhip)} adj. WHIP`;
}

export default function PitchingOptimizerPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [pitchingStats, setPitchingStats] = useState<PitchingStat[]>([]);

  const [selectedGameIds, setSelectedGameIds] = useState<number[]>([]);
  const [availablePitcherIds, setAvailablePitcherIds] = useState<number[]>([]);
  const [qualityByGame, setQualityByGame] = useState<
    Record<number, OpponentQuality>
  >({});
  const [minBF, setMinBF] = useState(6);

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
          .select(
            "id, game_date, season, opponent, our_score, opponent_score, result"
          )
          .order("game_date", { ascending: true }),

        supabase
          .from("players")
          .select("id, name, number")
          .order("name", { ascending: true }),

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

      const pitcherIds = Array.from(
        new Set(loadedPitching.map((row) => row.player_id))
      );
      setAvailablePitcherIds(pitcherIds);

      const initialQuality: Record<number, OpponentQuality> = {};
      loadedGames.forEach((game) => {
        initialQuality[game.id] = getSuggestedQuality(
          loadedGames,
          game.opponent
        );
      });
      setQualityByGame(initialQuality);

      setLoading(false);
    }

    loadData();
  }, []);

  const latestGameDate = useMemo(() => {
    if (games.length === 0) return "";
    return [...games]
      .map((game) => game.game_date)
      .sort()
      .at(-1) ?? "";
  }, [games]);

  const gameMap = useMemo(
    () => new Map(games.map((game) => [game.id, game])),
    [games]
  );

  const playerMap = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players]
  );

  const pitcherIds = useMemo(
    () =>
      Array.from(
        new Set(pitchingStats.map((row) => row.player_id))
      ),
    [pitchingStats]
  );

  const pitchers = useMemo(
    () => players.filter((player) => pitcherIds.includes(player.id)),
    [players, pitcherIds]
  );

  const maxAppearances = useMemo(() => {
    const counts = new Map<number, number>();

    pitchingStats
      .filter((row) => selectedGameIds.includes(row.game_id))
      .forEach((row) => {
        counts.set(row.player_id, (counts.get(row.player_id) ?? 0) + 1);
      });

    return Math.max(1, ...Array.from(counts.values()));
  }, [pitchingStats, selectedGameIds]);

  const pitcherSummaries = useMemo(() => {
    return pitchers.map((player): PitcherSummary => {
      const rows = pitchingStats.filter(
        (row) =>
          row.player_id === player.id &&
          selectedGameIds.includes(row.game_id)
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
      let maxIpAppearance = 0;

      let weightedIP = 0;
      let weightedBF = 0;
      let weightedPitches = 0;
      let weightedHits = 0;
      let weightedRuns = 0;
      let weightedER = 0;
      let weightedWalks = 0;
      let weightedK = 0;
      let weightedHBP = 0;
      let weightedHR = 0;

      rows.forEach((row) => {
        const ip = num(row.innings_pitched);
        const bf = n(row.batters_faced);
        const game = gameMap.get(row.game_id);

        const recency =
          game && latestGameDate
            ? recencyMultiplier(game.game_date, latestGameDate)
            : 1;

        const quality =
          qualityByGame[row.game_id] ?? "average";

        const appearanceWeight =
          recency * QUALITY_MULTIPLIERS[quality];

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
        maxIpAppearance = Math.max(maxIpAppearance, ip);

        weightedIP += ip * appearanceWeight;
        weightedBF += bf * appearanceWeight;
        weightedPitches += n(row.pitches) * appearanceWeight;
        weightedHits += n(row.hits_allowed) * appearanceWeight;
        weightedRuns += n(row.runs_allowed) * appearanceWeight;
        weightedER += n(row.earned_runs) * appearanceWeight;
        weightedWalks += n(row.walks) * appearanceWeight;
        weightedK += n(row.strikeouts) * appearanceWeight;
        weightedHBP += n(row.hbp) * appearanceWeight;
        weightedHR += n(row.home_runs_allowed) * appearanceWeight;
      });

      const appearances = rows.length;

      // Standard/raw stats for the selected games.
      const era = innings > 0 ? (earnedRuns * 9) / innings : 0;
      const whip = innings > 0 ? (walks + hits) / innings : 0;
      const kPct = battersFaced > 0 ? strikeouts / battersFaced : 0;
      const bbPct = battersFaced > 0 ? walks / battersFaced : 0;
      const freePassPct =
        battersFaced > 0 ? (walks + hbp) / battersFaced : 0;
      const kbb = walks > 0 ? strikeouts / walks : strikeouts;
      const hitsPerInning = innings > 0 ? hits / innings : 0;
      const runsPerInning = innings > 0 ? runs / innings : 0;
      const pitchesPerInning = innings > 0 ? pitches / innings : 0;
      const avgIpPerAppearance =
        appearances > 0 ? innings / appearances : 0;

      // Recency + opponent-quality adjusted rates.
      const adjustedEra =
        weightedIP > 0 ? (weightedER * 9) / weightedIP : 0;
      const adjustedWhip =
        weightedIP > 0
          ? (weightedWalks + weightedHits) / weightedIP
          : 0;
      const adjustedKPct =
        weightedBF > 0 ? weightedK / weightedBF : 0;
      const adjustedBBPct =
        weightedBF > 0 ? weightedWalks / weightedBF : 0;
      const adjustedFreePassPct =
        weightedBF > 0
          ? (weightedWalks + weightedHBP) / weightedBF
          : 0;
      const adjustedHitsPerInning =
        weightedIP > 0 ? weightedHits / weightedIP : 0;
      const adjustedRunsPerInning =
        weightedIP > 0 ? weightedRuns / weightedIP : 0;
      const adjustedHrPerBF =
        weightedBF > 0 ? weightedHR / weightedBF : 0;
      const adjustedKbb =
        weightedWalks > 0 ? weightedK / weightedWalks : weightedK;

      /*
        COMPONENT SCORES

        These convert different pitching statistics onto a 0–1 scale
        so they can be blended in the role formulas below.

        Lower ERA / WHIP / BB / H / HR = better.
        Higher K / K:BB / durability = better.
      */
      const runPreventionScore = clamp(1 - adjustedEra / 10);
      const whipScore = clamp((2.0 - adjustedWhip) / 1.4);
      const strikeoutScore = clamp(adjustedKPct / 0.35);
      const controlScore = clamp(1 - adjustedFreePassPct / 0.18);
      const hitPreventionScore = clamp(
        1 - adjustedHitsPerInning / 1.4
      );

      const durabilityScore =
        clamp(avgIpPerAppearance / 4) * 0.6 +
        clamp(maxIpAppearance / 5) * 0.4;

      const hrAvoidanceScore = clamp(
        1 - adjustedHrPerBF / 0.05
      );

      const kbbScore = clamp(adjustedKbb / 5);

      const attendanceScore = clamp(
        appearances / maxAppearances
      );

      // Full statistical confidence is reached at ~45 adjusted batters faced.
      const sampleFactor = clamp(weightedBF / 45);
      const confidenceMultiplier = 0.7 + 0.3 * sampleFactor;

      /*
        CLAY PITCHING FORMULA — WHO DESERVES INNINGS

        25% Run prevention
        20% WHIP
        18% Strikeout ability
        15% Control
        10% Hit prevention
        10% Durability/workload
         2% Attendance

        Every rate-stat component above is calculated from appearances
        that are already weighted for recency and opponent quality.
      */
      const overallRaw =
        runPreventionScore * 0.25 +
        whipScore * 0.2 +
        strikeoutScore * 0.18 +
        controlScore * 0.15 +
        hitPreventionScore * 0.1 +
        durabilityScore * 0.1 +
        attendanceScore * 0.02;

      /*
        STARTER
        28% run prevention
        22% WHIP
        18% durability
        12% control
        10% hit prevention
         8% strikeouts
         2% attendance
      */
      const starterRaw =
        runPreventionScore * 0.28 +
        whipScore * 0.22 +
        durabilityScore * 0.18 +
        controlScore * 0.12 +
        hitPreventionScore * 0.1 +
        strikeoutScore * 0.08 +
        attendanceScore * 0.02;

      /*
        FIRST RELIEVER
        24% WHIP
        22% strikeouts
        20% control
        14% run prevention
        10% hit prevention
         8% HR avoidance
         2% attendance
      */
      const reliefRaw =
        whipScore * 0.24 +
        strikeoutScore * 0.22 +
        controlScore * 0.2 +
        runPreventionScore * 0.14 +
        hitPreventionScore * 0.1 +
        hrAvoidanceScore * 0.08 +
        attendanceScore * 0.02;

      /*
        FIREMAN / RUNNERS-ON TRUST
        30% strikeouts
        25% control
        20% WHIP
        12% hit prevention
         8% run prevention
         3% HR avoidance
         2% attendance

        This is the "who do I trust when there are runners on base?"
        score. Strikeouts and avoiding free passes carry extra weight.
      */
      const firemanRaw =
        strikeoutScore * 0.3 +
        controlScore * 0.25 +
        whipScore * 0.2 +
        hitPreventionScore * 0.12 +
        runPreventionScore * 0.08 +
        hrAvoidanceScore * 0.03 +
        attendanceScore * 0.02;

      /*
        CLOSER / HIGH LEVERAGE
        30% strikeouts
        22% WHIP
        18% control
        12% run prevention
         8% hit prevention
         8% K:BB
         2% attendance
      */
      const closerRaw =
        strikeoutScore * 0.3 +
        whipScore * 0.22 +
        controlScore * 0.18 +
        runPreventionScore * 0.12 +
        hitPreventionScore * 0.08 +
        kbbScore * 0.08 +
        attendanceScore * 0.02;

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
        maxIpAppearance,

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
        attendanceScore,
        sampleFactor,

        overallScore: overallRaw * confidenceMultiplier,
        starterScore: starterRaw * confidenceMultiplier,
        reliefScore: reliefRaw * confidenceMultiplier,
        firemanScore: firemanRaw * confidenceMultiplier,
        closerScore: closerRaw * confidenceMultiplier,
      };
    });
  }, [
    pitchers,
    pitchingStats,
    selectedGameIds,
    gameMap,
    latestGameDate,
    qualityByGame,
    maxAppearances,
  ]);

  const eligiblePitchers = useMemo(
    () =>
      pitcherSummaries
        .filter(
          (pitcher) =>
            availablePitcherIds.includes(pitcher.playerId) &&
            pitcher.battersFaced >= minBF
        )
        .sort((a, b) => b.overallScore - a.overallScore),
    [pitcherSummaries, availablePitcherIds, minBF]
  );

  const plan = useMemo(() => {
    if (eligiblePitchers.length === 0) {
      return {
        starter: null as PitcherSummary | null,
        reliever: null as PitcherSummary | null,
        closer: null as PitcherSummary | null,
        fireman: null as PitcherSummary | null,
        starterInnings: 0,
        reliefInnings: 0,
      };
    }

    const starter = [...eligiblePitchers].sort(
      (a, b) => b.starterScore - a.starterScore
    )[0];

    const afterStarter = eligiblePitchers.filter(
      (pitcher) => pitcher.playerId !== starter.playerId
    );

    const closer =
      afterStarter.length > 0
        ? [...afterStarter].sort(
            (a, b) => b.closerScore - a.closerScore
          )[0]
        : null;

    const afterCloser = closer
      ? afterStarter.filter(
          (pitcher) => pitcher.playerId !== closer.playerId
        )
      : afterStarter;

    const reliever =
      afterCloser.length > 0
        ? [...afterCloser].sort(
            (a, b) => b.reliefScore - a.reliefScore
          )[0]
        : null;

    const firemanPool =
      afterStarter.length > 0 ? afterStarter : eligiblePitchers;

    const fireman = [...firemanPool].sort(
      (a, b) => b.firemanScore - a.firemanScore
    )[0];

    let starterInnings = 7;
    let reliefInnings = 0;

    if (closer && reliever) {
      // Adaptive but intentionally conservative for a 7-inning game.
      starterInnings =
        starter.avgIpPerAppearance >= 4.5 &&
        starter.starterScore >= 0.72
          ? 5
          : starter.avgIpPerAppearance < 2.5
          ? 3
          : 4;

      reliefInnings = Math.max(1, 6 - starterInnings);
    } else if (closer) {
      // Two-pitcher plan: starter gets the first six, closer gets the seventh.
      starterInnings = 6;
      reliefInnings = 0;
    }

    return {
      starter,
      reliever,
      closer,
      fireman,
      starterInnings,
      reliefInnings,
    };
  }, [eligiblePitchers]);

  function toggleGame(id: number) {
    setSelectedGameIds((current) =>
      current.includes(id)
        ? current.filter((gameId) => gameId !== id)
        : [...current, id]
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
        <h1 className="text-3xl font-bold">
          Iron Horse Pitching Optimizer
        </h1>
        <p className="mt-6 text-red-400">{error}</p>
      </main>
    );
  }

  const roleCards = [
    {
      role: "STARTER",
      pitcher: plan.starter,
      target: plan.starter
        ? `${plan.starterInnings} innings`
        : "—",
      score: plan.starter?.starterScore ?? 0,
      reason: plan.starter
        ? buildReason(plan.starter, "starter")
        : "",
      note: "Best blend of run prevention, traffic control and durability.",
    },
    {
      role: "FIRST RELIEVER",
      pitcher: plan.reliever,
      target: plan.reliever
        ? `${plan.reliefInnings} innings`
        : "Not scheduled",
      score: plan.reliever?.reliefScore ?? 0,
      reason: plan.reliever
        ? buildReason(plan.reliever, "relief")
        : "",
      note: "Best clean-inning relief profile after the starter exits.",
    },
    {
      role: "CLOSER",
      pitcher: plan.closer,
      target: plan.closer ? "7th inning" : "Not scheduled",
      score: plan.closer?.closerScore ?? 0,
      reason: plan.closer
        ? buildReason(plan.closer, "closer")
        : "",
      note: "Best high-leverage profile for protecting a late lead.",
    },
    {
      role: "RUNNERS-ON FIREMAN",
      pitcher: plan.fireman,
      target: plan.fireman ? "Use when trouble starts" : "—",
      score: plan.fireman?.firemanScore ?? 0,
      reason: plan.fireman
        ? buildReason(plan.fireman, "fireman")
        : "",
      note: "The pitcher the model trusts most to enter with runners already on.",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl p-6 md:p-10">
        {/* HEADER */}
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
              <a
                href="/pitching"
                className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white"
              >
                Pitching Optimizer
              </a>
            </nav>
          </div>

          <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
            Iron Horse
            <span className="block text-slate-300">
              Pitching Optimizer
            </span>
          </h1>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-400">
            Build a 21-out pitching plan around who is available tonight.
            The model rewards recent performance, gives extra credit for
            succeeding against strong opponents, discounts stat padding
            against weak teams, and separates starter, relief, runners-on,
            and closer trust.
          </p>
        </div>

        <section className="grid gap-6 lg:grid-cols-2">
          {/* COMPETITION + OPPONENT QUALITY */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Step 01
                </div>

                <h2 className="mt-1 text-xl font-bold">
                  Weight the Competition
                </h2>

                <p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">
                  Choose which appearances count, then tell the model how
                  strong each opponent was. Strong teams count 1.25×,
                  average teams 1.00× and weak teams 0.75×.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    setSelectedGameIds(games.map((game) => game.id))
                  }
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
                >
                  All
                </button>

                <button
                  onClick={() => setSelectedGameIds([])}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
                >
                  None
                </button>

                <button
                  onClick={resetOpponentQuality}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
                >
                  Reset Auto
                </button>
              </div>
            </div>

            <div className="mt-5 max-h-[34rem] space-y-3 overflow-y-auto pr-1">
              {games.map((game) => {
                const quality =
                  qualityByGame[game.id] ?? "average";
                const recency = latestGameDate
                  ? recencyMultiplier(
                      game.game_date,
                      latestGameDate
                    )
                  : 1;

                return (
                  <div
                    key={game.id}
                    className="rounded-xl bg-slate-950 px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedGameIds.includes(game.id)}
                          onChange={() => toggleGame(game.id)}
                          className="h-4 w-4"
                        />

                        <div>
                          <div className="font-medium">
                            {game.opponent}
                          </div>

                          <div className="text-xs text-slate-500">
                            {dateLabel(game.game_date)}
                            {" · "}
                            Recency {decimal(recency)}×
                          </div>
                        </div>
                      </label>

                      <div
                        className={
                          game.result === "W"
                            ? "font-semibold text-green-400"
                            : game.result === "L"
                            ? "font-semibold text-red-400"
                            : "font-semibold text-slate-300"
                        }
                      >
                        {game.result} {game.our_score}-{game.opponent_score}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {(
                        [
                          "strong",
                          "average",
                          "weak",
                        ] as OpponentQuality[]
                      ).map((value) => (
                        <button
                          key={value}
                          onClick={() =>
                            setQualityByGame((current) => ({
                              ...current,
                              [game.id]: value,
                            }))
                          }
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${qualityClasses(
                            value,
                            quality
                          )}`}
                        >
                          {qualityLabel(value)}
                          {" "}
                          {decimal(
                            QUALITY_MULTIPLIERS[value],
                            2
                          )}×
                        </button>
                      ))}

                      <div className="ml-auto self-center text-xs text-slate-500">
                        Combined weight{" "}
                        {decimal(
                          recency *
                            QUALITY_MULTIPLIERS[quality],
                          2
                        )}
                        ×
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-4 text-sm text-slate-400">
              {selectedGameIds.length} of {games.length} games selected.
              Opponent ratings are auto-suggested from Iron Horse&apos;s
              results against each team, but you can override every game.
            </p>
          </div>

          {/* AVAILABLE PITCHERS */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Step 02
                </div>

                <h2 className="mt-1 text-xl font-bold">
                  Set Tonight&apos;s Staff
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Only checked pitchers can be used in the 7-inning plan.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setAvailablePitcherIds(
                      pitchers.map((player) => player.id)
                    )
                  }
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
                >
                  All
                </button>

                <button
                  onClick={() => setAvailablePitcherIds([])}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
                >
                  None
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {pitchers.map((player) => {
                const summary = pitcherSummaries.find(
                  (pitcher) => pitcher.playerId === player.id
                );

                return (
                  <label
                    key={player.id}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-slate-950 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={availablePitcherIds.includes(player.id)}
                        onChange={() => togglePitcher(player.id)}
                        className="h-4 w-4"
                      />

                      <span>
                        {player.number ? `#${player.number} ` : ""}
                        {player.name}
                      </span>
                    </div>

                    <span className="text-xs text-slate-500">
                      {summary?.innings
                        ? `${decimal(summary.innings, 1)} IP`
                        : "0 IP"}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-4">
              <label className="flex items-center justify-between gap-4 text-sm">
                <span>
                  <span className="font-semibold">Minimum BF</span>
                  <span className="block text-xs text-slate-500">
                    Pitchers below this selected-game sample are excluded
                    from the recommendation.
                  </span>
                </span>

                <input
                  type="number"
                  min="0"
                  value={minBF}
                  onChange={(e) =>
                    setMinBF(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
                />
              </label>
            </div>

            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-4">
              <div className="text-sm font-semibold">
                Recency is automatic
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-400">
                <div>0–30 days: 1.00×</div>
                <div>31–60 days: 0.82×</div>
                <div>61–90 days: 0.68×</div>
                <div>91+ days: 0.55×</div>
              </div>
            </div>
          </div>
        </section>

        {/* 21 OUT PLAN */}
        <section className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Step 03 · Clay Pitching Formula Output
            </div>

            <h2 className="mt-1 text-3xl font-black">
              Tonight&apos;s 21-Out Plan
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              The scheduled plan assigns different pitchers to starter,
              first-relief and closer roles. The Fireman can overlap with a
              scheduled reliever because that recommendation answers a
              different question: who should enter immediately if runners
              are already on base?
            </p>
          </div>

          {eligiblePitchers.length === 0 ? (
            <div className="mt-6 rounded-xl bg-slate-950 p-6 text-slate-400">
              No available pitcher meets the current minimum BF.
            </div>
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {roleCards.map((card) => (
                <div
                  key={card.role}
                  className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-black tracking-wider ${roleBadgeClasses(
                          card.role
                        )}`}
                      >
                        {card.role}
                      </div>

                      <div className="mt-3 text-2xl font-black">
                        {card.pitcher
                          ? `${
                              card.pitcher.number
                                ? `#${card.pitcher.number} `
                                : ""
                            }${card.pitcher.name}`
                          : "No pitcher available"}
                      </div>

                      <div className="mt-1 text-sm font-semibold text-slate-300">
                        Target: {card.target}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-center">
                      <div className="text-xs uppercase tracking-widest text-slate-500">
                        Role Score
                      </div>
                      <div className="mt-1 text-2xl font-black">
                        {score100(card.score)}
                      </div>
                    </div>
                  </div>

                  {card.pitcher && (
                    <>
                      <p className="mt-4 text-sm leading-6 text-slate-400">
                        {card.note}
                      </p>

                      <div className="mt-3 text-sm font-medium text-slate-300">
                        {card.reason}
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
                        <div className="rounded-lg bg-slate-900 p-2">
                          <div className="text-[10px] uppercase tracking-wider text-slate-500">
                            ERA
                          </div>
                          <div className="mt-1 font-semibold">
                            {decimal(card.pitcher.era)}
                          </div>
                        </div>
                        <div className="rounded-lg bg-slate-900 p-2">
                          <div className="text-[10px] uppercase tracking-wider text-slate-500">
                            WHIP
                          </div>
                          <div className="mt-1 font-semibold">
                            {decimal(card.pitcher.whip)}
                          </div>
                        </div>
                        <div className="rounded-lg bg-slate-900 p-2">
                          <div className="text-[10px] uppercase tracking-wider text-slate-500">
                            K%
                          </div>
                          <div className="mt-1 font-semibold">
                            {percent(card.pitcher.kPct)}
                          </div>
                        </div>
                        <div className="rounded-lg bg-slate-900 p-2">
                          <div className="text-[10px] uppercase tracking-wider text-slate-500">
                            BB%
                          </div>
                          <div className="mt-1 font-semibold">
                            {percent(card.pitcher.bbPct)}
                          </div>
                        </div>
                        <div className="rounded-lg bg-slate-900 p-2">
                          <div className="text-[10px] uppercase tracking-wider text-slate-500">
                            K/BB
                          </div>
                          <div className="mt-1 font-semibold">
                            {decimal(card.pitcher.kbb)}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* PITCHER RANKINGS */}
        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Role Rankings
              </div>

              <h2 className="mt-1 text-2xl font-black">
                Pitcher Trust Board
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Raw stats describe what happened. The five scores on the
                right are recency- and opponent-quality-adjusted evaluations
                of how much the model trusts each pitcher in a specific role.
              </p>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[1250px] w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-3">Pitcher</th>
                  <th className="px-3 py-3">App</th>
                  <th className="px-3 py-3">IP</th>
                  <th className="px-3 py-3">ERA</th>
                  <th className="px-3 py-3">WHIP</th>
                  <th className="px-3 py-3">K%</th>
                  <th className="px-3 py-3">BB%</th>
                  <th className="px-3 py-3">K/BB</th>
                  <th className="px-3 py-3">H/IP</th>
                  <th className="px-3 py-3">R/IP</th>
                  <th className="px-3 py-3">P/IP</th>
                  <th className="px-3 py-3">Overall</th>
                  <th className="px-3 py-3">Start</th>
                  <th className="px-3 py-3">Relief</th>
                  <th className="px-3 py-3">Fireman</th>
                  <th className="px-3 py-3">Close</th>
                </tr>
              </thead>

              <tbody>
                {eligiblePitchers.map((pitcher) => (
                  <tr
                    key={pitcher.playerId}
                    className="border-b border-slate-800/70"
                  >
                    <td className="whitespace-nowrap px-3 py-4 font-semibold">
                      {pitcher.number ? `#${pitcher.number} ` : ""}
                      {pitcher.name}
                    </td>
                    <td className="px-3 py-4">{pitcher.appearances}</td>
                    <td className="px-3 py-4">
                      {decimal(pitcher.innings, 1)}
                    </td>
                    <td className="px-3 py-4">{decimal(pitcher.era)}</td>
                    <td className="px-3 py-4">{decimal(pitcher.whip)}</td>
                    <td className="px-3 py-4">{percent(pitcher.kPct)}</td>
                    <td className="px-3 py-4">{percent(pitcher.bbPct)}</td>
                    <td className="px-3 py-4">{decimal(pitcher.kbb)}</td>
                    <td className="px-3 py-4">
                      {decimal(pitcher.hitsPerInning)}
                    </td>
                    <td className="px-3 py-4">
                      {decimal(pitcher.runsPerInning)}
                    </td>
                    <td className="px-3 py-4">
                      {decimal(pitcher.pitchesPerInning, 1)}
                    </td>
                    <td className="px-3 py-4 font-black">
                      {score100(pitcher.overallScore)}
                    </td>
                    <td className="px-3 py-4">
                      {score100(pitcher.starterScore)}
                    </td>
                    <td className="px-3 py-4">
                      {score100(pitcher.reliefScore)}
                    </td>
                    <td className="px-3 py-4">
                      {score100(pitcher.firemanScore)}
                    </td>
                    <td className="px-3 py-4">
                      {score100(pitcher.closerScore)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* METHODOLOGY */}
        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Methodology
          </div>

          <h2 className="mt-1 text-2xl font-black">
            How the Clay Pitching Formula Works
          </h2>

          <div className="mt-5 max-w-5xl space-y-5 text-sm leading-7 text-slate-400">
            <p>
              <strong className="text-white">The core idea:</strong>{" "}
              the model does not treat every pitching appearance equally.
              Before any pitcher score is calculated, each appearance is
              weighted by both recency and opponent quality. A recent outing
              against a strong team can therefore influence the model much
              more than an older outing against a weak team.
            </p>

            <p>
              <strong className="text-white">Recency:</strong>{" "}
              appearances from the last 30 days receive a 1.00× weight,
              31–60 days receive 0.82×, 61–90 days receive 0.68× and
              appearances older than 90 days receive 0.55×. Recency is
              measured from the latest game in the dataset.
            </p>

            <p>
              <strong className="text-white">Opponent quality:</strong>{" "}
              Strong opponents receive a 1.25× multiplier, Average opponents
              1.00× and Weak opponents 0.75×. The app auto-suggests a starting
              classification from Iron Horse&apos;s results and run differential
              against each opponent, but every game can be manually changed.
              This is the main protection against inflated numbers from
              stat-padding appearances against weaker teams.
            </p>

            <p>
              <strong className="text-white">Overall Pitcher Score:</strong>{" "}
              25% run prevention, 20% WHIP, 18% strikeout ability, 15%
              control, 10% hit prevention, 10% durability/workload and 2%
              attendance. ERA, WHIP, strikeout rate, walk/HBP rate and hit
              prevention are calculated from the recency- and
              opponent-adjusted appearance data.
            </p>

            <p>
              <strong className="text-white">Starter Score:</strong>{" "}
              28% run prevention, 22% WHIP, 18% durability, 12% control,
              10% hit prevention, 8% strikeout ability and 2% attendance.
              This favors pitchers who can suppress runs and traffic while
              giving the team enough length to get through a meaningful part
              of a seven-inning game.
            </p>

            <p>
              <strong className="text-white">First Reliever Score:</strong>{" "}
              24% WHIP, 22% strikeout ability, 20% control, 14% run
              prevention, 10% hit prevention, 8% home-run avoidance and 2%
              attendance. The emphasis shifts toward preventing baserunners
              and generating outs immediately.
            </p>

            <p>
              <strong className="text-white">
                Runners-On Fireman Score:
              </strong>{" "}
              30% strikeout ability, 25% control, 20% WHIP, 12% hit
              prevention, 8% run prevention, 3% home-run avoidance and 2%
              attendance. This is specifically designed to answer,
              “Who do we trust to come in with runners already on base?”
              Because the export does not contain inherited-runner outcomes,
              this is a skills-based estimate rather than a direct inherited
              runners allowed statistic.
            </p>

            <p>
              <strong className="text-white">Closer Score:</strong>{" "}
              30% strikeout ability, 22% WHIP, 18% control, 12% run
              prevention, 8% hit prevention, 8% K/BB and 2% attendance.
              This profile prioritizes missing bats and avoiding free passes
              when a single baserunner can change the game.
            </p>

            <p>
              <strong className="text-white">Sample confidence:</strong>{" "}
              every role score is multiplied by a confidence factor that
              rises from 70% to 100% as the pitcher approaches roughly 45
              recency/quality-adjusted batters faced. This prevents a tiny
              sample from automatically beating a pitcher with a much larger
              body of work.
            </p>

            <p>
              <strong className="text-white">21-out plan:</strong>{" "}
              the model selects the best Starter first, then chooses the best
              remaining Closer and First Reliever. Starter innings are
              conservatively adjusted from three to five based on historical
              workload and the starter score; the closer is reserved for the
              seventh. The Fireman recommendation is separate and can overlap
              with another relief role because it represents an emergency
              runners-on decision rather than a scheduled inning assignment.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
