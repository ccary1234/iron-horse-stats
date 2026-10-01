                    <td className="px-3 py-4">{decimal(pitcher.medianIpAppearance, 1)}</td>
                    <td className="px-3 py-4">{pitcher.twoPlusInningAppearances}</td>
                    <td className="px-3 py-4">{pitcher.threePlusInningAppearances}</td>
                    <td className="px-3 py-4">{pitcher.fourPlusInningAppearances}</td>
                    <td className="px-3 py-4">{score100(pitcher.starterWorkloadScore)}</td>
                    <td className="px-3 py-4">{score100(pitcher.starterRoleMultiplier)}</td>
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
          <h2 className="mt-1 text-2xl font-black">Pitching Optimizer v5</h2>
          <div className="mt-5 max-w-5xl space-y-4 text-sm leading-7 text-slate-400">
            <p><strong className="text-white">Starter raw formula:</strong> unchanged from v4: 30% demonstrated starter workload, 22% run prevention, 15% WHIP, 10% control, 8% hit prevention, 5% strikeouts and 10% experience/sample reliability.</p>
            <p><strong className="text-white">Why v4 barely moved the rankings:</strong> workload was still only an additive 30% of the score. A pitcher with limited starter history could still compensate with strong rate statistics, so the model was still behaving too much like a general pitching ranking.</p>
            <p><strong className="text-white">Major v5 change — starter role fit is now multiplicative:</strong> after calculating the raw starter score and normal sample-confidence adjustment, the result is multiplied by a Starter Fit factor equal to 35% + 65% of the Starter Workload score. A pitcher with almost no demonstrated starter history retains only about 35% of his starter score; a fully demonstrated starter retains 100%.</p>
            <p><strong className="text-white">Starter-workload component:</strong> 30% repeated 3+ inning appearances, 25% repeated 4+ inning appearances, 20% median appearance length, 15% total innings and 10% longest appearance. Repeated 3-5 inning outings matter substantially more than one unusually long appearance.</p>
            <p><strong className="text-white">Practical effect:</strong> Stanton's repeated long-outing history should now receive a large structural advantage in the starter ranking. Cary can still score highly in runners-on or other situational-relief models, but strong relief rate stats can no longer fully offset limited starter history.</p>
            <p><strong className="text-white">Other pitching formulas:</strong> tight-game, runners-on, late-lead, multi-inning and blowout scores are unchanged. This v5 adjustment affects only the starter ranking.</p>
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
