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

type BattingStat = {
  game_id: number;
  player_id: number;
  pa: number | null;
  ab: number | null;
  runs: number | null;
  hits: number | null;
  singles: number | null;
  doubles: number | null;
  triples: number | null;
  home_runs: number | null;
  rbi: number | null;
  walks: number | null;
  intentional_walks: number | null;
  hbp: number | null;
  strikeouts: number | null;
  sacrifice_flies: number | null;
  sacrifice_bunts: number | null;
  stolen_bases: number | null;
  caught_stealing: number | null;
  pitches_seen: number | null;
  qab: number | null;
};

type PlayerSummary = {
  playerId: number;
  name: string;
  number: string | number | null;

  games: number;
  pa: number;
  ab: number;
  runs: number;
  hits: number;
  singles: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  xbh: number;
  rbi: number;
  walks: number;
  hbp: number;
  strikeouts: number;
  stolenBases: number;
  caughtStealing: number;
  sacrificeFlies: number;
  qab: number;
  pitchesSeen: number;

  avg: number;
  obp: number;
  slg: number;
  ops: number;
  bbPct: number;
  kPct: number;
  contactPct: number;
  qabPct: number;
  stealRate: number;
  pitchesPerPA: number;
  hrRate: number;
  xbhRate: number;
  rbiRate: number;

  attendanceScore: number;
  sampleFactor: number;
  overallScore: number;
};

const n = (value: number | null | undefined) => Number(value ?? 0);

function pct(value: number) {
  if (!Number.isFinite(value)) return ".000";
  return value.toFixed(3).replace(/^0/, "");
}

function percent(value: number) {
  if (!Number.isFinite(value)) return "0.0%";
  return `${(value * 100).toFixed(1)}%`;
}

function decimal(value: number) {
  if (!Number.isFinite(value)) return "0.00";
  return value.toFixed(2);
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

/*
  ORIGINAL CLAY FORMULA

  The overallScore determines WHO makes the lineup.

  The battingOrderScore determines WHERE each selected hitter bats.

  Each batting-order spot has a different role and therefore uses
  a different weighting profile.
*/
function battingOrderScore(player: PlayerSummary, spot: number) {
  const pitchScore = clamp(player.pitchesPerPA / 5);
  const speedScore = clamp(player.stealRate * 5);
  const powerScore = clamp(player.slg / 1.25);
  const opsScore = clamp(player.ops / 1.5);
  const hrScore = clamp(player.hrRate * 10);
  const xbhScore = clamp(player.xbhRate * 5);
  const rbiScore = clamp(player.rbiRate * 3);

  let score = 0;

  // #1 — LEADOFF
  if (spot === 1) {
    score =
      player.obp * 0.35 +
      pitchScore * 0.2 +
      speedScore * 0.15 +
      player.bbPct * 0.1 +
      player.qabPct * 0.08 +
      player.contactPct * 0.1 +
      player.attendanceScore * 0.02;
  }

  // #2 — TABLE SETTER / COMPLETE HITTER
  else if (spot === 2) {
    score =
      player.obp * 0.28 +
      player.contactPct * 0.17 +
      player.qabPct * 0.15 +
      powerScore * 0.14 +
      player.avg * 0.1 +
      pitchScore * 0.07 +
      player.bbPct * 0.06 +
      player.attendanceScore * 0.03;
  }

  // #3 — BEST BALANCED HITTER
  else if (spot === 3) {
    score =
      opsScore * 0.28 +
      player.obp * 0.22 +
      powerScore * 0.22 +
      player.avg * 0.12 +
      player.qabPct * 0.08 +
      player.contactPct * 0.06 +
      player.attendanceScore * 0.02;
  }

  // #4 — CLEANUP
  else if (spot === 4) {
    score =
      powerScore * 0.34 +
      xbhScore * 0.17 +
      hrScore * 0.15 +
      rbiScore * 0.12 +
      opsScore * 0.1 +
      player.obp * 0.06 +
      player.qabPct * 0.04 +
      player.attendanceScore * 0.02;
  }

  // #5 — SECONDARY RUN PRODUCER
  else if (spot === 5) {
    score =
      powerScore * 0.28 +
      opsScore * 0.2 +
      xbhScore * 0.15 +
      rbiScore * 0.12 +
      player.obp * 0.1 +
      player.qabPct * 0.07 +
      player.contactPct * 0.06 +
      player.attendanceScore * 0.02;
  }

  // #6 — BEST REMAINING COMPLETE HITTER
  else if (spot === 6) {
    score =
      opsScore * 0.24 +
      player.obp * 0.2 +
      powerScore * 0.18 +
      player.avg * 0.1 +
      player.qabPct * 0.1 +
      player.contactPct * 0.1 +
      speedScore * 0.05 +
      player.attendanceScore * 0.03;
  }

  // #7 — CONTACT / QUALITY AB
  else if (spot === 7) {
    score =
      player.contactPct * 0.23 +
      player.qabPct * 0.2 +
      player.obp * 0.2 +
      opsScore * 0.12 +
      player.avg * 0.1 +
      pitchScore * 0.07 +
      speedScore * 0.05 +
      player.attendanceScore * 0.03;
  }

  // #8 — BEST REMAINING OFFENSIVE VALUE
  else if (spot === 8) {
    score =
      opsScore * 0.22 +
      player.obp * 0.2 +
      player.contactPct * 0.17 +
      player.qabPct * 0.15 +
      player.avg * 0.1 +
      powerScore * 0.08 +
      speedScore * 0.05 +
      player.attendanceScore * 0.03;
  }

  // #9 — SECOND LEADOFF TYPE
  else if (spot === 9) {
    score =
      player.obp * 0.28 +
      player.contactPct * 0.2 +
      speedScore * 0.14 +
      pitchScore * 0.12 +
      player.bbPct * 0.08 +
      player.qabPct * 0.08 +
      player.avg * 0.07 +
      player.attendanceScore * 0.03;
  }

  // 10+ hitter lineups use the general offensive score.
  else {
    score = player.overallScore;
  }

  return score * (0.65 + 0.35 * player.sampleFactor);
}

export default function Home() {
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [battingStats, setBattingStats] = useState<BattingStat[]>([]);

  const [selectedGameIds, setSelectedGameIds] = useState<number[]>([]);
  const [availablePlayerIds, setAvailablePlayerIds] = useState<number[]>([]);

  const [minPA, setMinPA] = useState(0);
  const [lineupSize, setLineupSize] = useState(9);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const [
        { data: gameData, error: gameError },
        { data: playerData, error: playerError },
        { data: battingData, error: battingError },
      ] = await Promise.all([
        supabase.from("games").select("*").order("game_date"),
        supabase.from("players").select("*").order("name"),
        supabase.from("batting_stats").select("*"),
      ]);

      const loadError = gameError || playerError || battingError;

      if (loadError) {
        setError(loadError.message);
        setLoading(false);
        return;
      }

      const loadedGames = (gameData ?? []) as Game[];
      const loadedPlayers = (playerData ?? []) as Player[];

      setGames(loadedGames);
      setPlayers(loadedPlayers);
      setBattingStats((battingData ?? []) as BattingStat[]);

      setSelectedGameIds(loadedGames.map((game) => game.id));
      setAvailablePlayerIds(loadedPlayers.map((player) => player.id));

      setLoading(false);
    }

    loadData();
  }, []);

  const summaries = useMemo<PlayerSummary[]>(() => {
    const selected = new Set(selectedGameIds);

    const basePlayers = players.map((player) => {
      const rows = battingStats.filter(
        (row) => row.player_id === player.id && selected.has(row.game_id)
      );

      const pa = rows.reduce((sum, row) => sum + n(row.pa), 0);
      const ab = rows.reduce((sum, row) => sum + n(row.ab), 0);
      const runs = rows.reduce((sum, row) => sum + n(row.runs), 0);
      const hits = rows.reduce((sum, row) => sum + n(row.hits), 0);
      const doubles = rows.reduce((sum, row) => sum + n(row.doubles), 0);
      const triples = rows.reduce((sum, row) => sum + n(row.triples), 0);
      const homeRuns = rows.reduce((sum, row) => sum + n(row.home_runs), 0);
      const rbi = rows.reduce((sum, row) => sum + n(row.rbi), 0);
      const walks = rows.reduce((sum, row) => sum + n(row.walks), 0);
      const hbp = rows.reduce((sum, row) => sum + n(row.hbp), 0);
      const strikeouts = rows.reduce((sum, row) => sum + n(row.strikeouts), 0);
      const stolenBases = rows.reduce((sum, row) => sum + n(row.stolen_bases), 0);
      const caughtStealing = rows.reduce(
        (sum, row) => sum + n(row.caught_stealing),
        0
      );
      const sacrificeFlies = rows.reduce(
        (sum, row) => sum + n(row.sacrifice_flies),
        0
      );
      const qab = rows.reduce((sum, row) => sum + n(row.qab), 0);
      const pitchesSeen = rows.reduce((sum, row) => sum + n(row.pitches_seen), 0);

      const singlesFromRows = rows.reduce(
        (sum, row) => sum + n(row.singles),
        0
      );

      const singles =
        singlesFromRows ||
        Math.max(hits - doubles - triples - homeRuns, 0);

      const xbh = doubles + triples + homeRuns;

      const totalBases =
        singles +
        doubles * 2 +
        triples * 3 +
        homeRuns * 4;

      const avg = ab > 0 ? hits / ab : 0;

      const obpDenominator =
        ab +
        walks +
        hbp +
        sacrificeFlies;

      const obp =
        obpDenominator > 0
          ? (hits + walks + hbp) / obpDenominator
          : 0;

      const slg = ab > 0 ? totalBases / ab : 0;
      const ops = obp + slg;

      const bbPct = pa > 0 ? walks / pa : 0;
      const kPct = pa > 0 ? strikeouts / pa : 0;
      const contactPct = pa > 0 ? 1 - strikeouts / pa : 0;
      const qabPct = pa > 0 ? qab / pa : 0;

      const stealRate =
        pa > 0
          ? Math.max(
              (stolenBases - caughtStealing * 0.5) / pa,
              0
            )
          : 0;

      const pitchesPerPA = pa > 0 ? pitchesSeen / pa : 0;
      const hrRate = pa > 0 ? homeRuns / pa : 0;
      const xbhRate = pa > 0 ? xbh / pa : 0;
      const rbiRate = pa > 0 ? rbi / pa : 0;

      return {
        playerId: player.id,
        name: player.name,
        number: player.number,

        games: rows.length,
        pa,
        ab,
        runs,
        hits,
        singles,
        doubles,
        triples,
        homeRuns,
        xbh,
        rbi,
        walks,
        hbp,
        strikeouts,
        stolenBases,
        caughtStealing,
        sacrificeFlies,
        qab,
        pitchesSeen,

        avg,
        obp,
        slg,
        ops,
        bbPct,
        kPct,
        contactPct,
        qabPct,
        stealRate,
        pitchesPerPA,
        hrRate,
        xbhRate,
        rbiRate,
      };
    });

    const maxGames = Math.max(
      1,
      ...basePlayers.map((player) => player.games)
    );

    return basePlayers
      .map((player) => {
        const attendanceScore = player.games / maxGames;
        const sampleFactor = Math.min(player.pa / 20, 1);

        /*
          GENERAL HITTER SCORE

          This decides WHO makes the lineup.

          49% OBP
          34% SLG
          10% contact
           5% adjusted baserunning
           2% attendance
        */
        const speedScore = clamp(player.stealRate * 5);

        /*
          GENERAL HITTER SCORE

          This decides WHO makes the lineup.

          49% OBP
          34% SLG
          10% contact
           5% adjusted baserunning
           2% attendance

          The goal is to keep lineup selection focused on
          actual offensive production while still giving a
          very small nod to reliability/availability.
        */
        const rawOverallScore =
          player.obp * 0.49 +
          player.slg * 0.34 +
          player.contactPct * 0.10 +
          speedScore * 0.05 +
          attendanceScore * 0.02;

        return {
          ...player,
          attendanceScore,
          sampleFactor,
          overallScore:
            rawOverallScore *
            (0.65 + 0.35 * sampleFactor),
        };
      })
      .filter((player) => player.pa >= minPA)
      .sort((a, b) => b.overallScore - a.overallScore);
  }, [
    players,
    battingStats,
    selectedGameIds,
    minPA,
  ]);

  const rankedAvailablePlayers = useMemo(() => {
    const available = new Set(availablePlayerIds);

    return summaries
      .filter((player) => available.has(player.playerId))
      .sort((a, b) => b.overallScore - a.overallScore);
  }, [summaries, availablePlayerIds]);

  /*
    STEP 1:
    Pick the hitters who make the lineup using overallScore.
  */
  const selectedLineupPlayers = useMemo(() => {
    return rankedAvailablePlayers.slice(0, lineupSize);
  }, [rankedAvailablePlayers, lineupSize]);

  /*
    STEP 2:
    Assign those selected hitters to batting-order roles.

    Priority:
    1. Leadoff
    2. Cleanup
    3. #2
    4. #3
    5. #5
    6. #6
    7. #9
    8. #7
    9. #8

    This preserves the original Clay Formula logic.
  */
  const recommendedLineup = useMemo(() => {
    const remaining = [...selectedLineupPlayers];
    const assignments = new Map<number, PlayerSummary>();

    const specializedPriority = [
      1,
      4,
      2,
      3,
      5,
      6,
      9,
      7,
      8,
    ].filter((spot) => spot <= lineupSize);

    for (let spot = 10; spot <= lineupSize; spot++) {
      specializedPriority.push(spot);
    }

    specializedPriority.forEach((spot) => {
      if (remaining.length === 0) return;

      const bestPlayer = [...remaining].sort(
        (a, b) =>
          battingOrderScore(b, spot) -
          battingOrderScore(a, spot)
      )[0];

      assignments.set(spot, bestPlayer);

      const index = remaining.findIndex(
        (player) => player.playerId === bestPlayer.playerId
      );

      if (index >= 0) {
        remaining.splice(index, 1);
      }
    });

    return Array.from(
      {
        length: Math.min(
          lineupSize,
          selectedLineupPlayers.length
        ),
      },
      (_, index) => assignments.get(index + 1)
    ).filter(
      (player): player is PlayerSummary => Boolean(player)
    );
  }, [selectedLineupPlayers, lineupSize]);

  const benchPlayers = useMemo(() => {
    const lineupIds = new Set(
      selectedLineupPlayers.map((player) => player.playerId)
    );

    return rankedAvailablePlayers.filter(
      (player) => !lineupIds.has(player.playerId)
    );
  }, [rankedAvailablePlayers, selectedLineupPlayers]);

  function toggleGame(id: number) {
    setSelectedGameIds((current) =>
      current.includes(id)
        ? current.filter((gameId) => gameId !== id)
        : [...current, id]
    );
  }

  function togglePlayer(id: number) {
    setAvailablePlayerIds((current) =>
      current.includes(id)
        ? current.filter((playerId) => playerId !== id)
        : [...current, id]
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        Loading Iron Horse Run Maximizer...
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        <h1 className="text-3xl font-bold">
          Iron Horse Run Maximizer
        </h1>

        <p className="mt-6 text-red-400">
          {error}
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl p-6 md:p-10">

        {/* HEADER */}

        <div className="mb-8">
          <div className="inline-flex rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Iron Horse Baseball · 2026
          </div>

          <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
            Iron Horse
            <span className="block text-slate-300">
              Run Maximizer
            </span>
          </h1>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-400">
            A weighted lineup optimization engine built to maximize run production.
            Select the games that matter, mark who is available, choose how many
            hitters you want in the order, and the Clay Formula builds the lineup
            around the job of each batting spot.
          </p>
        </div>

        <section className="grid gap-6 lg:grid-cols-2">

          {/* GAME SELECTOR */}

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Step 01
                </div>

                <h2 className="mt-1 text-xl font-bold">
                  Choose the Competition
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Only checked games feed the lineup model.
                </p>
              </div>

              <div className="flex gap-2">
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
              </div>
            </div>

            <div className="mt-5 max-h-96 space-y-2 overflow-y-auto">
              {games.map((game) => (
                <label
                  key={game.id}
                  className="flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-slate-950 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
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
                        {new Date(
                          `${game.game_date}T12:00:00`
                        ).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

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
                </label>
              ))}
            </div>

            <p className="mt-4 text-sm text-slate-400">
              {selectedGameIds.length} of {games.length} games selected
            </p>
          </div>

          {/* AVAILABILITY */}

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Step 02
                </div>

                <h2 className="mt-1 text-xl font-bold">
                  Set Tonight&apos;s Roster
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Only checked players can make the lineup.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setAvailablePlayerIds(players.map((player) => player.id))
                  }
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
                >
                  All
                </button>

                <button
                  onClick={() => setAvailablePlayerIds([])}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
                >
                  None
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {players.map((player) => (
                <label
                  key={player.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl bg-slate-950 px-4 py-3"
                >
                  <input
                    type="checkbox"
                    checked={availablePlayerIds.includes(player.id)}
                    onChange={() => togglePlayer(player.id)}
                    className="h-4 w-4"
                  />

                  <span>
                    {player.number ? `#${player.number} ` : ""}
                    {player.name}
                  </span>
                </label>
              ))}
            </div>

            <p className="mt-4 text-sm text-slate-400">
              {availablePlayerIds.length} players available
            </p>
          </div>
        </section>

        {/* RECOMMENDED LINEUP */}

        <section className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Step 03 · Clay Formula Output
              </div>

              <h2 className="mt-1 text-3xl font-black">
                Maximum-Run Weighted Lineup
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                The model first identifies the strongest available hitters,
                then assigns them to batting-order roles using the original
                weighted Clay Formula.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-3 text-sm">
                Batters

                <input
                  type="number"
                  min="1"
                  max={availablePlayerIds.length || 1}
                  value={lineupSize}
                  onChange={(e) =>
                    setLineupSize(
                      Math.max(
                        1,
                        Math.min(
                          availablePlayerIds.length || 1,
                          Number(e.target.value) || 1
                        )
                      )
                    )
                  }
                  className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                />
              </label>

              <label className="flex items-center gap-3 text-sm">
                Minimum PA

                <input
                  type="number"
                  min="0"
                  value={minPA}
                  onChange={(e) =>
                    setMinPA(Number(e.target.value) || 0)
                  }
                  className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                />
              </label>
            </div>
          </div>

          <div className="mt-6 max-w-4xl space-y-3">
            {recommendedLineup.map((player, index) => (
              <div
                key={player.playerId}
                className="flex items-center gap-4 rounded-xl bg-slate-950 px-5 py-4"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-lg font-black">
                  {index + 1}
                </div>

                <div>
                  <div className="text-lg font-semibold">
                    {player.number ? `#${player.number} ` : ""}
                    {player.name}
                  </div>

                  <div className="mt-1 text-sm text-slate-400">
                    {player.pa} PA
                    {" · "}
                    {pct(player.avg)} AVG
                    {" · "}
                    {pct(player.obp)} OBP
                    {" · "}
                    {pct(player.slg)} SLG
                    {" · "}
                    {pct(player.ops)} OPS
                    {" · "}
                    {player.stolenBases} SB
                    {" · "}
                    {decimal(player.pitchesPerPA)} P/PA
                  </div>
                </div>
              </div>
            ))}
          </div>

          {benchPlayers.length > 0 && (
            <div className="mt-8 border-t border-slate-800 pt-6">
              <h3 className="font-semibold text-slate-300">
                Available Players Outside the Recommended Lineup
              </h3>

              <div className="mt-3 flex flex-wrap gap-2">
                {benchPlayers.map((player) => (
                  <div
                    key={player.playerId}
                    className="rounded-lg bg-slate-950 px-3 py-2 text-sm text-slate-400"
                  >
                    {player.number ? `#${player.number} ` : ""}
                    {player.name}
                    {" · "}
                    {pct(player.ops)} OPS
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* PERFORMANCE TABLE */}

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div>
            <h2 className="text-xl font-bold">
              Player Performance
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              All rate stats are recalculated from the games selected above.
            </p>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[1250px] text-left text-sm">
              <thead className="border-b border-slate-700 text-slate-400">
                <tr>
                  <th className="p-3">Player</th>
                  <th className="p-3">G</th>
                  <th className="p-3">PA</th>
                  <th className="p-3">AVG</th>
                  <th className="p-3">OBP</th>
                  <th className="p-3">SLG</th>
                  <th className="p-3">OPS</th>
                  <th className="p-3">H</th>
                  <th className="p-3">2B</th>
                  <th className="p-3">3B</th>
                  <th className="p-3">HR</th>
                  <th className="p-3">RBI</th>
                  <th className="p-3">SB</th>
                  <th className="p-3">CS</th>
                  <th className="p-3">P/PA</th>
                  <th className="p-3">BB%</th>
                  <th className="p-3">K%</th>
                  <th className="p-3">QAB%</th>
                </tr>
              </thead>

              <tbody>
                {summaries.map((player) => (
                  <tr
                    key={player.playerId}
                    className="border-b border-slate-800"
                  >
                    <td className="p-3 font-medium">
                      {player.number ? `#${player.number} ` : ""}
                      {player.name}
                    </td>

                    <td className="p-3">{player.games}</td>
                    <td className="p-3">{player.pa}</td>
                    <td className="p-3">{pct(player.avg)}</td>
                    <td className="p-3">{pct(player.obp)}</td>
                    <td className="p-3">{pct(player.slg)}</td>
                    <td className="p-3 font-semibold">{pct(player.ops)}</td>
                    <td className="p-3">{player.hits}</td>
                    <td className="p-3">{player.doubles}</td>
                    <td className="p-3">{player.triples}</td>
                    <td className="p-3">{player.homeRuns}</td>
                    <td className="p-3">{player.rbi}</td>
                    <td className="p-3">{player.stolenBases}</td>
                    <td className="p-3">{player.caughtStealing}</td>
                    <td className="p-3">{decimal(player.pitchesPerPA)}</td>
                    <td className="p-3">{percent(player.bbPct)}</td>
                    <td className="p-3">{percent(player.kPct)}</td>
                    <td className="p-3">{percent(player.qabPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* METHODOLOGY */}

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Behind the Formula
          </div>

          <h2 className="mt-1 text-2xl font-bold">
            How the Clay Formula Builds the Lineup
          </h2>

          <div className="mt-4 max-w-4xl space-y-4 text-sm leading-7 text-slate-300">
            <p>
              The goal is to build the strongest run-producing lineup from the
              players who are available. The model makes two separate decisions:
              first, who deserves to be in the lineup, and second, which batting
              spot best fits each selected hitter.
            </p>

            <p>
              <strong className="text-white">Who makes the lineup:</strong>{" "}
              49% OBP, 34% SLG, 10% contact rate, 5% adjusted baserunning,
              and 2% attendance. This intentionally puts most of the decision
              on the two things that matter most offensively: avoiding outs and
              doing damage. Contact adds a smaller preference for hitters who
              put the ball in play, adjusted baserunning rewards useful speed
              without letting it overwhelm hitting, and attendance is kept at
              only 2% as a very small reliability factor.
            </p>

            <p>
              QAB%, BB%, pitches per plate appearance, home-run rate,
              extra-base-hit rate, RBI rate, and other secondary traits are
              still used where they make sense in the batting-order formulas
              below. They no longer decide whether a clearly stronger overall
              hitter makes the lineup in the first place.
            </p>

            <p>
              <strong className="text-white">#1 — Leadoff:</strong>{" "}
              35% OBP, 20% pitches per plate appearance, 15% speed, 10% BB%,
              10% contact, 8% QAB%, and 2% attendance. The goal is to reach base,
              work counts, create pressure, and avoid outs.
            </p>

            <p>
              <strong className="text-white">#2 — Table Setter:</strong>{" "}
              28% OBP, 17% contact, 15% QAB%, 14% power, 10% AVG, 7% pitches
              per plate appearance, 6% BB%, and 3% attendance.
            </p>

            <p>
              <strong className="text-white">#3 — Best Balanced Hitter:</strong>{" "}
              28% OPS, 22% OBP, 22% power, 12% AVG, 8% QAB%, 6% contact,
              and 2% attendance.
            </p>

            <p>
              <strong className="text-white">#4 — Cleanup:</strong>{" "}
              34% power, 17% extra-base-hit rate, 15% home-run rate, 12% RBI
              rate, 10% OPS, 6% OBP, 4% QAB%, and 2% attendance.
            </p>

            <p>
              <strong className="text-white">#5 — Secondary Run Producer:</strong>{" "}
              28% power, 20% OPS, 15% extra-base-hit rate, 12% RBI rate,
              10% OBP, 7% QAB%, 6% contact, and 2% attendance.
            </p>

            <p>
              <strong className="text-white">#6 — Complete Hitter:</strong>{" "}
              24% OPS, 20% OBP, 18% power, 10% AVG, 10% QAB%, 10% contact,
              5% speed, and 3% attendance.
            </p>

            <p>
              <strong className="text-white">#7 — Contact / Quality AB:</strong>{" "}
              23% contact, 20% QAB%, 20% OBP, 12% OPS, 10% AVG, 7% pitches
              per plate appearance, 5% speed, and 3% attendance.
            </p>

            <p>
              <strong className="text-white">#8 — Remaining Offensive Value:</strong>{" "}
              22% OPS, 20% OBP, 17% contact, 15% QAB%, 10% AVG, 8% power,
              5% speed, and 3% attendance.
            </p>

            <p>
              <strong className="text-white">#9 — Second Leadoff:</strong>{" "}
              28% OBP, 20% contact, 14% speed, 12% pitches per plate appearance,
              8% BB%, 8% QAB%, 7% AVG, and 3% attendance.
            </p>

            <p className="text-slate-400">
              Power, OPS, HR rate, extra-base-hit rate, RBI rate, speed, and
              pitches per plate appearance are normalized before entering the
              positional formulas so that one statistic cannot dominate simply
              because it uses a larger numerical scale. The same sample-confidence
              adjustment is then applied to every positional score.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
