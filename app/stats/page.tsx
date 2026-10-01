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
