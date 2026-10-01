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
};

type HitterSort = keyof Hitter;
type PitcherSort = keyof Pitcher;

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

function LeaderCard({ label, name, value, sub }: { label: string; name: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-black text-white">{name}</div>
      <div className="mt-1 text-2xl font-black text-emerald-400">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
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
        supabase.from("pitching_stats").select("game_id, player_id, innings_pitched, batters_faced, hits_allowed, runs_allowed, earned_runs, walks, strikeouts, hbp, wins, losses, saves"),
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
      wins: sum("wins"), losses: sum("losses"), saves: sum("saves"), hits, runs: sum("runs_allowed"),
      earnedRuns, walks, strikeouts, hbp: sum("hbp"), battersFaced: bf,
      era: innings ? earnedRuns * 9 / innings : 0, whip: innings ? (walks + hits) / innings : 0,
      kbb: walks ? strikeouts / walks : strikeouts, kPct: bf ? strikeouts / bf : 0, bbPct: bf ? walks / bf : 0,
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
  const maxH = (key: keyof Hitter) => [...qualifiedHitters].sort((a,b) => Number(b[key]) - Number(a[key]))[0];
  const maxAllH = (key: keyof Hitter) => [...hitters].sort((a,b) => Number(b[key]) - Number(a[key]))[0];
  const minP = (key: keyof Pitcher) => [...qualifiedPitchers].sort((a,b) => Number(a[key]) - Number(b[key]))[0];
  const maxP = (key: keyof Pitcher) => [...pitchers].sort((a,b) => Number(b[key]) - Number(a[key]))[0];

  const wins = games.filter(g => g.result === "W").length;
  const losses = games.filter(g => g.result === "L").length;
  const runsFor = games.reduce((s,g) => s + n(g.our_score), 0);
  const runsAgainst = games.reduce((s,g) => s + n(g.opponent_score), 0);
  const teamAB = hitters.reduce((s,h) => s+h.ab,0), teamH = hitters.reduce((s,h) => s+h.hits,0);
  const teamBB = hitters.reduce((s,h) => s+h.walks,0), teamHBP = hitters.reduce((s,h) => s+h.hbp,0);
  const teamPA = hitters.reduce((s,h) => s+h.pa,0);
  const teamAVG = teamAB ? teamH/teamAB : 0;
  const teamOBP = teamPA ? (teamH+teamBB+teamHBP)/teamPA : 0;

  const hitterHeaders: [string,HitterSort][] = [
    ["Player","name"],["G","games"],["PA","pa"],["AB","ab"],["R","runs"],["H","hits"],["2B","doubles"],
    ["3B","triples"],["HR","homeRuns"],["RBI","rbi"],["BB","walks"],["HBP","hbp"],["SO","strikeouts"],
    ["SB","stolenBases"],["CS","caughtStealing"],["AVG","avg"],["OBP","obp"],["SLG","slg"],["OPS","ops"],
    ["QAB%","qabPct"],["P/PA","pitchesPerPA"]
  ];
  const pitcherHeaders: [string,PitcherSort][] = [
    ["Pitcher","name"],["APP","appearances"],["IP","innings"],["W","wins"],["L","losses"],["SV","saves"],
    ["H","hits"],["R","runs"],["ER","earnedRuns"],["BB","walks"],["K","strikeouts"],["HBP","hbp"],
    ["ERA","era"],["WHIP","whip"],["K/BB","kbb"],["K%","kPct"],["BB%","bbPct"]
  ];

  if (loading) return <main className="min-h-screen bg-slate-950 p-8 text-white">Loading 2026 season stats...</main>;
  if (error) return <main className="min-h-screen bg-slate-950 p-8 text-white"><h1 className="text-3xl font-bold">2026 Season Stats</h1><p className="mt-6 text-red-400">{error}</p></main>;

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
          <p className="mt-1 text-sm text-slate-500">Rate-stat leaders require 20 plate appearances.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {[
              ["AVG",maxH("avg"),h=>dec(h.avg)],["OBP",maxH("obp"),h=>dec(h.obp)],["SLG",maxH("slg"),h=>dec(h.slg)],
              ["OPS",maxH("ops"),h=>dec(h.ops)],["Hits",maxAllH("hits"),h=>String(h.hits)],["Runs",maxAllH("runs"),h=>String(h.runs)],
              ["RBI",maxAllH("rbi"),h=>String(h.rbi)],["Doubles",maxAllH("doubles"),h=>String(h.doubles)],["Home Runs",maxAllH("homeRuns"),h=>String(h.homeRuns)],
              ["Walks",maxAllH("walks"),h=>String(h.walks)],["Stolen Bases",maxAllH("stolenBases"),h=>String(h.stolenBases)],["QAB%",maxH("qabPct"),h=>pct(h.qabPct)]
            ].map(([label,leader,format]: any) => leader && <LeaderCard key={label} label={label} name={leader.name} value={format(leader)} />)}
          </div>
        </section>

        <section className="mt-8">
          <div className="text-xs font-bold uppercase tracking-widest text-sky-400">Team leaders</div>
          <h2 className="mt-1 text-2xl font-black">Pitching Leaders</h2>
          <p className="mt-1 text-sm text-slate-500">ERA and WHIP leaders require 10 innings pitched.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {[
              ["ERA",minP("era"),p=>dec2(p.era)],["WHIP",minP("whip"),p=>dec2(p.whip)],["Strikeouts",maxP("strikeouts"),p=>String(p.strikeouts)],
              ["K%",[...qualifiedPitchers].sort((a,b)=>b.kPct-a.kPct)[0],p=>pct(p.kPct)],["K/BB",[...qualifiedPitchers].sort((a,b)=>b.kbb-a.kbb)[0],p=>dec2(p.kbb)],
              ["Innings Pitched",maxP("innings"),p=>dec2(p.innings)],["Wins",maxP("wins"),p=>String(p.wins)],["Saves",maxP("saves"),p=>String(p.saves)]
            ].map(([label,leader,format]: any) => leader && <LeaderCard key={label} label={label} name={leader.name} value={format(leader)} />)}
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
                <td className="px-3 py-3">{p.hits}</td><td className="px-3 py-3">{p.runs}</td><td className="px-3 py-3">{p.earnedRuns}</td><td className="px-3 py-3">{p.walks}</td><td className="px-3 py-3">{p.strikeouts}</td><td className="px-3 py-3">{p.hbp}</td>
                <td className="px-3 py-3">{dec2(p.era)}</td><td className="px-3 py-3">{dec2(p.whip)}</td><td className="px-3 py-3">{dec2(p.kbb)}</td><td className="px-3 py-3">{pct(p.kPct)}</td><td className="px-3 py-3">{pct(p.bbPct)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
