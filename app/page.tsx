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

type PitchingStat = {
  game_id: number;
  player_id: number;
  innings_pitched: number | string | null;
  batters_faced: number | null;
  hits_allowed: number | null;
  runs_allowed: number | null;
  earned_runs: number | null;
  walks: number | null;
  strikeouts: number | null;
  hbp: number | null;
  wins: number | null;
  losses: number | null;
  saves: number | null;
  wild_pitches: number | null;
};

type Hitter = {
  playerId: number;
  name: string;
  number: string | number | null;
  games: number;
  pa: number;
  ab: number;
  runs: number;
  hits: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  rbi: number;
  walks: number;
  hbp: number;
  strikeouts: number;
  stolenBases: number;
  caughtStealing: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  qabPct: number;
  pitchesPerPA: number;
};

type Pitcher = {
  playerId: number;
  name: string;
  number: string | number | null;
  appearances: number;
  innings: number;
  wins: number;
  losses: number;
  saves: number;
  wildPitches: number;
  hits: number;
  runs: number;
  earnedRuns: number;
  walks: number;
  strikeouts: number;
  hbp: number;
  battersFaced: number;
  era: number;
  whip: number;
  kbb: number;
  kPct: number;
  bbPct: number;
  walksPerInning: number;
  strikeoutsPerInning: number;
};

type HitterSort = keyof Hitter;
type PitcherSort = keyof Pitcher;

const hitterHeaders: Array<[string, HitterSort]> = [
  ["Player", "name"], ["G", "games"], ["PA", "pa"], ["AB", "ab"], ["R", "runs"],
  ["H", "hits"], ["2B", "doubles"], ["3B", "triples"], ["HR", "homeRuns"], ["RBI", "rbi"],
  ["BB", "walks"], ["HBP", "hbp"], ["SO", "strikeouts"], ["SB", "stolenBases"], ["CS", "caughtStealing"],
  ["AVG", "avg"], ["OBP", "obp"], ["SLG", "slg"], ["OPS", "ops"], ["QAB%", "qabPct"], ["P/PA", "pitchesPerPA"],
];

const pitcherHeaders: Array<[string, PitcherSort]> = [
  ["Player", "name"], ["App", "appearances"], ["IP", "innings"], ["W", "wins"], ["L", "losses"], ["SV", "saves"],
  ["H", "hits"], ["R", "runs"], ["ER", "earnedRuns"], ["BB", "walks"], ["K", "strikeouts"], ["HBP", "hbp"],
  ["WP", "wildPitches"], ["ERA", "era"], ["WHIP", "whip"], ["K/BB", "kbb"], ["K%", "kPct"], ["BB%", "bbPct"],
  ["BB/IP", "walksPerInning"], ["K/IP", "strikeoutsPerInning"],
];

const n = (value: number | null | undefined) => Number(value ?? 0);
const num = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const dec = (value: number, digits = 3) =>
  Number.isFinite(value) ? value.toFixed(digits).replace(/^0/, "") : "—";
const dec2 = (value: number) => (Number.isFinite(value) ? value.toFixed(2) : "—");
const pct = (value: number) => (Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "—");

function Nav() {
  return (
    <nav className="flex flex-wrap rounded-xl border border-slate-800 bg-slate-900 p-1 text-sm">
      <a href="/" className="rounded-lg px-4 py-2 text-slate-400 hover:bg-slate-800 hover:text-white">Run Maximizer</a>
      <a href="/pitching" className="rounded-lg px-4 py-2 text-slate-400 hover:bg-slate-800 hover:text-white">Pitching Optimizer</a>
      <a href="/stats" className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white">Season Stats</a>
    </nav>
  );
}

function TopFiveCard({
  label,
  leaders,
}: {
  label: string;
  leaders: { name: string; value: string; detail?: string }[];
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-3 space-y-3">
        {leaders.slice(0, 5).map((leader, index) => (
          <div key={`${label}-${leader.name}-${index}`} className="flex items-start gap-3">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
              index === 0 ? "bg-emerald-400 text-slate-950" : "bg-slate-800 text-slate-300"
            }`}>
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold text-white">{leader.name}</div>
              {leader.detail && <div className="mt-0.5 text-xs text-slate-500">{leader.detail}</div>}
            </div>
            <div className={`whitespace-nowrap font-black ${index === 0 ? "text-emerald-400" : "text-slate-300"}`}>
              {leader.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SeasonStatsPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [batting, setBatting] = useState<BattingStat[]>([]);
  const [pitching, setPitching] = useState<PitchingStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hitterSort, setHitterSort] = useState<HitterSort>("ops");
  const [hitterAsc, setHitterAsc] = useState(false);
  const [pitcherSort, setPitcherSort] = useState<PitcherSort>("innings");
  const [pitcherAsc, setPitcherAsc] = useState(false);

  useEffect(() => {
    async function load() {
      const [g, p, b, pit] = await Promise.all([
        supabase.from("games").select("id, game_date, season, opponent, our_score, opponent_score, result").eq("season", 2026).order("game_date"),
        supabase.from("players").select("id, name, number").order("name"),
        supabase.from("batting_stats").select("game_id, player_id, pa, ab, runs, hits, singles, doubles, triples, home_runs, rbi, walks, intentional_walks, hbp, strikeouts, sacrifice_flies, sacrifice_bunts, stolen_bases, caught_stealing, pitches_seen, qab"),
        supabase.from("pitching_stats").select("game_id, player_id, innings_pitched, batters_faced, hits_allowed, runs_allowed, earned_runs, walks, strikeouts, hbp, wild_pitches, wins, losses, saves"),
      ]);
      const err = g.error || p.error || b.error || pit.error;
      if (err) setError(err.message);
      else {
        setGames((g.data ?? []) as Game[]);
        setPlayers((p.data ?? []) as Player[]);
        setBatting((b.data ?? []) as BattingStat[]);
        setPitching((pit.data ?? []) as PitchingStat[]);
      }
      setLoading(false);
    }
    load();
  }, []);

  const gameIds = useMemo(() => new Set(games.map(g => g.id)), [games]);

  const hitters = useMemo<Hitter[]>(() => players.map(player => {
    const rows = batting.filter(r => r.player_id === player.id && gameIds.has(r.game_id));
    const gamesPlayed = new Set(rows.map(r => r.game_id)).size;
    const sum = (key: keyof BattingStat) => rows.reduce((s, r) => s + n(r[key] as number | null), 0);
    const pa = sum("pa"), ab = sum("ab"), hits = sum("hits"), doubles = sum("doubles"),
      triples = sum("triples"), hr = sum("home_runs"), walks = sum("walks"), hbp = sum("hbp"),
      sf = sum("sacrifice_flies"), singles = sum("singles");
    const avg = ab ? hits / ab : 0;
    const obpDen = ab + walks + hbp + sf;
    const obp = obpDen ? (hits + walks + hbp) / obpDen : 0;
    const tb = singles + doubles * 2 + triples * 3 + hr * 4;
    const slg = ab ? tb / ab : 0;
    return {
      playerId: player.id, name: player.name, number: player.number, games: gamesPlayed, pa, ab,
      runs: sum("runs"), hits, doubles, triples, homeRuns: hr, rbi: sum("rbi"), walks, hbp,
      strikeouts: sum("strikeouts"), stolenBases: sum("stolen_bases"), caughtStealing: sum("caught_stealing"),
      avg, obp, slg, ops: obp + slg, qabPct: pa ? sum("qab") / pa : 0,
      pitchesPerPA: pa ? sum("pitches_seen") / pa : 0,
    };
  }).filter(h => h.pa > 0), [players, batting, gameIds]);

  const pitchers = useMemo<Pitcher[]>(() => players.map(player => {
    const rows = pitching.filter(r => r.player_id === player.id && gameIds.has(r.game_id));
    const sum = (key: keyof PitchingStat) => rows.reduce((s, r) => s + n(r[key] as number | null), 0);
    const innings = rows.reduce((s, r) => s + num(r.innings_pitched), 0);
    const hits = sum("hits_allowed"), walks = sum("walks"), strikeouts = sum("strikeouts"),
      earnedRuns = sum("earned_runs"), bf = sum("batters_faced");
    return {
      playerId: player.id, name: player.name, number: player.number, appearances: rows.length, innings,
      wins: sum("wins"), losses: sum("losses"), saves: sum("saves"), wildPitches: sum("wild_pitches"), hits, runs: sum("runs_allowed"),
      earnedRuns, walks, strikeouts, hbp: sum("hbp"), battersFaced: bf,
      era: innings ? earnedRuns * 9 / innings : 0, whip: innings ? (walks + hits) / innings : 0,
      kbb: walks ? strikeouts / walks : strikeouts, kPct: bf ? strikeouts / bf : 0, bbPct: bf ? walks / bf : 0,
      walksPerInning: innings ? walks / innings : 0,
      strikeoutsPerInning: innings ? strikeouts / innings : 0,
    };
  }).filter(p => p.appearances > 0), [players, pitching, gameIds]);

  const sortedHitters = useMemo(() => [...hitters].sort((a,b) => {
    const av = a[hitterSort], bv = b[hitterSort];
    const cmp = typeof av === "string" ? String(av).localeCompare(String(bv)) : Number(av) - Number(bv);
    return hitterAsc ? cmp : -cmp;
  }), [hitters, hitterSort, hitterAsc]);

  const sortedPitchers = useMemo(() => [...pitchers].sort((a,b) => {
    const av = a[pitcherSort], bv = b[pitcherSort];
    const cmp = typeof av === "string" ? String(av).localeCompare(String(bv)) : Number(av) - Number(bv);
    return pitcherAsc ? cmp : -cmp;
  }), [pitchers, pitcherSort, pitcherAsc]);

  const setHS = (key: HitterSort) => {
    if (key === hitterSort) setHitterAsc(v => !v); else { setHitterSort(key); setHitterAsc(false); }
  };
  const setPS = (key: PitcherSort) => {
    if (key === pitcherSort) setPitcherAsc(v => !v); else { setPitcherSort(key); setPitcherAsc(false); }
  };

  const qualifiedHitters = hitters.filter(h => h.pa >= 20);
  const qualifiedPitchers = pitchers.filter(p => p.innings >= 10);

  const topHitters = (key: keyof Hitter, qualified = false) =>
    [...(qualified ? qualifiedHitters : hitters)]
      .sort((a, b) => Number(b[key]) - Number(a[key]))
      .slice(0, 5);

  const topPitchers = (key: keyof Pitcher, qualified = false, lowerIsBetter = false) =>
    [...(qualified ? qualifiedPitchers : pitchers)]
      .sort((a, b) =>
        lowerIsBetter
          ? Number(a[key]) - Number(b[key])
          : Number(b[key]) - Number(a[key])
      )
      .slice(0, 5);

  // Curated inherited-runner history from the private pitching tool.
  // This page exposes only the underlying results, not the optimizer score.
  const firemanLeaders = [
    { playerId: 7, appearances: 6, inherited: 15, stranded: 9, successes: 3, partials: 3 },
    { playerId: 15, appearances: 2, inherited: 3, stranded: 2, successes: 1, partials: 1 },
    { playerId: 6, appearances: 1, inherited: 2, stranded: 2, successes: 1, partials: 0 },
    { playerId: 3, appearances: 1, inherited: 1, stranded: 1, successes: 1, partials: 0 },
    { playerId: 13, appearances: 1, inherited: 2, stranded: 0, successes: 0, partials: 0 },
  ]
    .map(f => ({ ...f, name: players.find(p => p.id === f.playerId)?.name ?? `Player ${f.playerId}` }))
    .sort((a, b) =>
      b.successes - a.successes ||
      b.appearances - a.appearances ||
      b.stranded - a.stranded ||
      b.inherited - a.inherited
    )
    .slice(0, 5);

  const wins = games.filter(g => g.result === "W").length;
  const losses = games.filter(g => g.result === "L").length;
  const runsFor = games.reduce((s,g) => s + n(g.our_score), 0);
  const runsAgainst = games.reduce((s,g) => s + n(g.opponent_score), 0);
  const teamAB = hitters.reduce((s,h) => s+h.ab,0), teamH = hitters.reduce((s,h) => s+h.hits,0);
  const teamBB = hitters.reduce((s,h) => s+h.walks,0), teamHBP = hitters.reduce((s,h) => s+h.hbp,0);
  const teamPA = hitters.reduce((s,h) => s+h.pa,0);
  const teamAVG = teamAB ? teamH/teamAB : 0;
  const teamOBP = teamPA ? (teamH+teamBB+teamHBP)/teamPA : 0;

  // Iron Horse Estimated WAR
  //
  // This is a transparent team-specific estimate, not FanGraphs/Baseball-Reference WAR.
  // We calculate offensive production with linear weights, then compare it with a
  // replacement-level baseline rather than the average Iron Horse hitter.
  //
  // Replacement level is set 20 runs per 600 PA below the team-average hitter
  // (0.0333 runs per PA). That keeps useful regulars from being treated as having
  // negative value simply because the team itself hit well.
  //
  // Pitching uses the same idea: team-average run prevention plus a replacement
  // allowance of 0.20 runs per inning. Baserunning is valued separately.
  //
  // 10 runs = approximately 1 win for this estimate.
  const warRows = useMemo(() => {
    const hitterById = new Map(hitters.map(h => [h.playerId, h]));
    const pitcherById = new Map(pitchers.map(p => [p.playerId, p]));
    const ids = new Set([...hitterById.keys(), ...pitcherById.keys()]);

    // Linear-weight batting production.
    const battingRunValue = (h: Hitter) => {
      const singles = Math.max(h.hits - h.doubles - h.triples - h.homeRuns, 0);
      return (
        0.69 * h.walks +
        0.72 * h.hbp +
        0.89 * singles +
        1.27 * h.doubles +
        1.62 * h.triples +
        2.10 * h.homeRuns
      );
    };

    const teamWeightedRuns = hitters.reduce((sum, h) => sum + battingRunValue(h), 0);
    const totalPA = hitters.reduce((sum, h) => sum + h.pa, 0);
    const teamWeightedRunsPerPA = totalPA ? teamWeightedRuns / totalPA : 0;

    // Replacement hitter is 20 runs / 600 PA below team average.
    const replacementRunsPerPA = Math.max(teamWeightedRunsPerPA - 20 / 600, 0);

    const totalPitchingIP = pitchers.reduce((sum, p) => sum + p.innings, 0);
    const totalPitchingER = pitchers.reduce((sum, p) => sum + p.earnedRuns, 0);
    const teamERPerInning = totalPitchingIP ? totalPitchingER / totalPitchingIP : 0;

    // Replacement pitcher is allowed 0.20 additional earned runs per inning
    // versus the team's average pitcher.
    const replacementERPerInning = teamERPerInning + 0.20;

    const RUNS_PER_WIN = 10;

    return [...ids]
      .map(playerId => {
        const h = hitterById.get(playerId);
        const p = pitcherById.get(playerId);

        let battingRunsAboveReplacement = 0;
        let baserunningRuns = 0;
        let pitchingRunsAboveReplacement = 0;

        if (h && h.pa > 0) {
          const playerWeightedRuns = battingRunValue(h);
          const replacementWeightedRuns = replacementRunsPerPA * h.pa;

          // Positive means the player's batting production exceeded what a
          // replacement hitter would be expected to produce in the same PA.
          battingRunsAboveReplacement =
            playerWeightedRuns - replacementWeightedRuns;

          // Approximate run values for steals/caught stealing.
          baserunningRuns =
            0.20 * h.stolenBases -
            0.40 * h.caughtStealing;
        }

        if (p && p.innings > 0) {
          const replacementER = replacementERPerInning * p.innings;

          // Runs prevented versus a replacement pitcher over the same innings.
          pitchingRunsAboveReplacement =
            replacementER - p.earnedRuns;
        }

        const totalRunsAboveReplacement =
          battingRunsAboveReplacement +
          baserunningRuns +
          pitchingRunsAboveReplacement;

        const player = players.find(x => x.id === playerId);

        return {
          playerId,
          name: player?.name ?? `Player ${playerId}`,
          battingRunsAboveReplacement,
          baserunningRuns,
          pitchingRunsAboveReplacement,
          totalRunsAboveReplacement,
          war: totalRunsAboveReplacement / RUNS_PER_WIN,
        };
      })
      .sort((a, b) => b.war - a.war);
  }, [hitters, pitchers, players]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-[1500px] p-5 md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[.2em] text-slate-400">Iron Horse Baseball · 2026</div>
          <Nav />
        </div>
        <h1 className="mt-6 text-4xl font-black tracking-tight md:text-6xl">2026 Season <span className="text-slate-300">Stats</span></h1>
        <p className="mt-3 max-w-3xl text-slate-400">Full-season team and player statistics. No lineup or pitching recommendations—just the numbers from the 2026 season.</p>

        <section className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
          {[["Record",`${wins}-${losses}`],["Games",String(games.length)],["Runs",String(runsFor)],["Runs Allowed",String(runsAgainst)],
            ["Run Diff",`${runsFor-runsAgainst>=0?"+":""}${runsFor-runsAgainst}`],["Team AVG",dec(teamAVG)],["Team OBP",dec(teamOBP)],["Team SB",String(hitters.reduce((s,h)=>s+h.stolenBases,0))]
          ].map(([label,value]) => <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div><div className="mt-2 text-2xl font-black">{value}</div></div>)}
        </section>

        <section className="mt-8">
          <div className="text-xs font-bold uppercase tracking-widest text-emerald-400">Team leaders</div>
          <h2 className="mt-1 text-2xl font-black">Batting Leaders</h2>
          <p className="mt-1 text-sm text-slate-500">Top five in each category. Rate-stat leaders require 20 plate appearances.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[
              ["AVG", topHitters("avg", true), (h: Hitter) => dec(h.avg)],
              ["OBP", topHitters("obp", true), (h: Hitter) => dec(h.obp)],
              ["SLG", topHitters("slg", true), (h: Hitter) => dec(h.slg)],
              ["OPS", topHitters("ops", true), (h: Hitter) => dec(h.ops)],
              ["Hits", topHitters("hits"), (h: Hitter) => String(h.hits)],
              ["Runs", topHitters("runs"), (h: Hitter) => String(h.runs)],
              ["RBI", topHitters("rbi"), (h: Hitter) => String(h.rbi)],
              ["Doubles", topHitters("doubles"), (h: Hitter) => String(h.doubles)],
              ["Home Runs", topHitters("homeRuns"), (h: Hitter) => String(h.homeRuns)],
              ["Walks", topHitters("walks"), (h: Hitter) => String(h.walks)],
              ["Stolen Bases", topHitters("stolenBases"), (h: Hitter) => String(h.stolenBases)],
              ["Strikeouts", topHitters("strikeouts"), (h: Hitter) => String(h.strikeouts)],
              ["QAB%", topHitters("qabPct", true), (h: Hitter) => pct(h.qabPct)],
            ].map(([label, leaders, format]: any) => (
              <TopFiveCard
                key={label}
                label={label}
                leaders={(leaders as Hitter[]).map(h => ({ name: h.name, value: format(h) }))}
              />
            ))}
          </div>
        </section>

        <section className="mt-8">
          <div className="text-xs font-bold uppercase tracking-widest text-sky-400">Team leaders</div>
          <h2 className="mt-1 text-2xl font-black">Pitching Leaders</h2>
          <p className="mt-1 text-sm text-slate-500">Top five in each category. ERA, WHIP, K% and K/BB require 10 innings pitched.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[
              ["ERA", topPitchers("era", true, true), (p: Pitcher) => dec2(p.era)],
              ["WHIP", topPitchers("whip", true, true), (p: Pitcher) => dec2(p.whip)],
              ["Strikeouts", topPitchers("strikeouts"), (p: Pitcher) => String(p.strikeouts)],
              ["K%", topPitchers("kPct", true), (p: Pitcher) => pct(p.kPct)],
              ["K/BB", topPitchers("kbb", true), (p: Pitcher) => dec2(p.kbb)],
              ["Innings Pitched", topPitchers("innings"), (p: Pitcher) => dec2(p.innings)],
              ["Wins", topPitchers("wins"), (p: Pitcher) => String(p.wins)],
              ["Saves", topPitchers("saves"), (p: Pitcher) => String(p.saves)],
              ["Walks Allowed", topPitchers("walks"), (p: Pitcher) => String(p.walks)],
              ["BB / Inning", topPitchers("walksPerInning", true), (p: Pitcher) => dec2(p.walksPerInning)],
              ["K / Inning", topPitchers("strikeoutsPerInning", true), (p: Pitcher) => dec2(p.strikeoutsPerInning)],
              ["Wild Pitches", topPitchers("wildPitches"), (p: Pitcher) => String(p.wildPitches)],
            ].map(([label, leaders, format]: any) => (
              <TopFiveCard
                key={label}
                label={label}
                leaders={(leaders as Pitcher[]).map(p => ({ name: p.name, value: format(p) }))}
              />
            ))}

            <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
              <div className="rounded-2xl border border-amber-500/30 bg-slate-900 p-5">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-amber-400">🔥 Fireman</div>
                    <h3 className="mt-1 text-xl font-black text-white">Inherited-Runner Leaders</h3>
                  </div>
                  <div className="text-xs text-slate-500">Curated mid-inning relief appearances</div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {firemanLeaders.map((f, index) => (
                    <div key={f.playerId} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${
                          index === 0 ? "bg-amber-400 text-slate-950" : "bg-slate-800 text-slate-300"
                        }`}>
                          {index + 1}
                        </div>
                        <div className="font-black text-white">{f.name}</div>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <div><div className="text-xl font-black text-white">{f.appearances}</div><div className="text-[10px] uppercase tracking-wider text-slate-500">Jams</div></div>
                        <div><div className="text-xl font-black text-white">{f.inherited}</div><div className="text-[10px] uppercase tracking-wider text-slate-500">Inherited</div></div>
                        <div><div className="text-xl font-black text-amber-400">{f.stranded}</div><div className="text-[10px] uppercase tracking-wider text-slate-500">Stranded</div></div>
                      </div>
                      <div className="mt-3 text-center text-xs text-slate-500">{f.successes} clean escapes · {f.partials} partial</div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-slate-500">Fireman ordering emphasizes repeated successful jam escapes and volume. It does not expose the private pitching-optimizer score.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-2xl font-black">Full Batting Stats</h2>
          <p className="mt-1 text-sm text-slate-500">Click any column heading to sort.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[1600px] w-full text-left text-sm">
              <thead className="border-b border-slate-700 text-xs uppercase tracking-wider text-slate-500"><tr>
                {hitterHeaders.map(([label,key]) => <th key={key} onClick={()=>setHS(key)} className="cursor-pointer whitespace-nowrap px-3 py-3 hover:text-white">{label}{hitterSort===key?(hitterAsc?" ↑":" ↓"):""}</th>)}
              </tr></thead>
              <tbody>{sortedHitters.map(h => <tr key={h.playerId} className="border-b border-slate-800/70 hover:bg-slate-800/30">
                <td className="whitespace-nowrap px-3 py-3 font-semibold text-white">{h.number?`#${h.number} `:""}{h.name}</td>
                {[h.games,h.pa,h.ab,h.runs,h.hits,h.doubles,h.triples,h.homeRuns,h.rbi,h.walks,h.hbp,h.strikeouts,h.stolenBases,h.caughtStealing].map((v,i)=><td key={i} className="px-3 py-3">{v}</td>)}
                <td className="px-3 py-3">{dec(h.avg)}</td><td className="px-3 py-3">{dec(h.obp)}</td><td className="px-3 py-3">{dec(h.slg)}</td><td className="px-3 py-3 font-bold text-white">{dec(h.ops)}</td>
                <td className="px-3 py-3">{pct(h.qabPct)}</td><td className="px-3 py-3">{dec2(h.pitchesPerPA)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-2xl font-black">Full Pitching Stats</h2>
          <p className="mt-1 text-sm text-slate-500">Traditional full-season statistics only. Click any column heading to sort.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[1250px] w-full text-left text-sm">
              <thead className="border-b border-slate-700 text-xs uppercase tracking-wider text-slate-500"><tr>
                {pitcherHeaders.map(([label,key]) => <th key={key} onClick={()=>setPS(key)} className="cursor-pointer whitespace-nowrap px-3 py-3 hover:text-white">{label}{pitcherSort===key?(pitcherAsc?" ↑":" ↓"):""}</th>)}
              </tr></thead>
              <tbody>{sortedPitchers.map(p => <tr key={p.playerId} className="border-b border-slate-800/70 hover:bg-slate-800/30">
                <td className="whitespace-nowrap px-3 py-3 font-semibold text-white">{p.number?`#${p.number} `:""}{p.name}</td>
                <td className="px-3 py-3">{p.appearances}</td><td className="px-3 py-3">{dec2(p.innings)}</td><td className="px-3 py-3">{p.wins}</td><td className="px-3 py-3">{p.losses}</td><td className="px-3 py-3">{p.saves}</td>
                <td className="px-3 py-3">{p.hits}</td><td className="px-3 py-3">{p.runs}</td><td className="px-3 py-3">{p.earnedRuns}</td><td className="px-3 py-3">{p.walks}</td><td className="px-3 py-3">{p.strikeouts}</td><td className="px-3 py-3">{p.hbp}</td><td className="px-3 py-3">{p.wildPitches}</td>
                <td className="px-3 py-3">{dec2(p.era)}</td><td className="px-3 py-3">{dec2(p.whip)}</td><td className="px-3 py-3">{dec2(p.kbb)}</td><td className="px-3 py-3">{pct(p.kPct)}</td><td className="px-3 py-3">{pct(p.bbPct)}</td><td className="px-3 py-3">{dec2(p.walksPerInning)}</td><td className="px-3 py-3">{dec2(p.strikeoutsPerInning)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-violet-500/30 bg-slate-900 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-violet-400">Experimental · Replacement-Level Model</div>
              <h2 className="mt-1 text-2xl font-black">Estimated WAR — Every Player</h2>
            </div>
            <div className="text-xs text-slate-500">Sorted highest to lowest</div>
          </div>

          <p className="mt-2 max-w-5xl text-sm text-slate-400">
            This Iron Horse estimate measures value above a replacement-level player, not value above the average Iron Horse player.
            Batting uses linear run values for BB, HBP, singles, doubles, triples and home runs; baserunning credits steals and penalizes
            caught stealing; pitching measures earned runs prevented versus a replacement pitcher. Two-way players receive both batting
            and pitching value.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Hitting replacement level</div>
              <div className="mt-1 text-sm text-slate-300">Team-average production minus 20 runs per 600 PA</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Pitching replacement level</div>
              <div className="mt-1 text-sm text-slate-300">Team-average ER rate + 0.20 runs allowed per inning</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Runs → Wins</div>
              <div className="mt-1 text-sm text-slate-300">10 runs above replacement ≈ 1 estimated win</div>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[950px] w-full text-left text-sm">
              <thead className="border-b border-slate-700 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-3">Rank</th>
                  <th className="px-3 py-3">Player</th>
                  <th className="px-3 py-3">Batting RAR</th>
                  <th className="px-3 py-3">Baserunning Runs</th>
                  <th className="px-3 py-3">Pitching RAR</th>
                  <th className="px-3 py-3">Total RAR</th>
                  <th className="px-3 py-3">Est. WAR</th>
                </tr>
              </thead>
              <tbody>
                {warRows.map((row, index) => (
                  <tr key={row.playerId} className="border-b border-slate-800/70 hover:bg-slate-800/30">
                    <td className="px-3 py-3 font-bold text-slate-500">{index + 1}</td>
                    <td className="px-3 py-3 font-semibold text-white">{row.name}</td>
                    <td className="px-3 py-3">{row.battingRunsAboveReplacement.toFixed(1)}</td>
                    <td className="px-3 py-3">{row.baserunningRuns.toFixed(1)}</td>
                    <td className="px-3 py-3">{row.pitchingRunsAboveReplacement.toFixed(1)}</td>
                    <td className="px-3 py-3 font-bold">{row.totalRunsAboveReplacement.toFixed(1)}</td>
                    <td className="px-3 py-3 text-lg font-black text-violet-300">{row.war.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-xs leading-5 text-slate-500">
            <strong className="text-slate-300">What RAR means:</strong> Runs Above Replacement. A positive Batting RAR means the hitter
            produced more estimated offensive value than a replacement-level hitter would have produced in the same number of plate
            appearances. This is a transparent team-specific estimate and is not directly comparable with MLB WAR. Defense and positional
            adjustments are excluded because the current database does not contain enough reliable defensive data.
          </div>
        </section>
      </div>
    </main>
  );
}
