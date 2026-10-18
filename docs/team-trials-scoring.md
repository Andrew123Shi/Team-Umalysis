# Team Trials Scoring

How Team Trials scores are stored in horseACT `TT-*.json` files, how the game totals them, and how Team Umalysis reproduces them. Every rule below was verified against real save files: with all bonuses included, the app's totals match the in-game totals exactly (1,032 files, Oct 2026).

## Where scores live in the save file

| Path | Meaning |
|---|---|
| `support_card_bonus` (top level) | Support card deck bonus in hundredths of a percent (`1575` = 15.75%). |
| `race_start_params_array[i].race_horse_data_array[]` | Runners. `team_id` (1 = player), `team_member_id` (1 = ace), `popularity` (favorite rank). |
| `race_start_params_array[i].self_evaluate` / `opponent_evaluate` | Team ratings. |
| `race_result_array[i].chara_result_array[].score_array` | Score lines for one runner. Only the player's team (team 1) has any. |
| `race_result_array[i].team_score_array` | Team-wide score lines (IDs 94 / 95). |
| `race_result_array[i].team_total_score` | The race score shown in game. Always equals the sum of every `score` in that race's runner and team arrays. |
| `race_result_array[i].win_type` | `1` = player won the race, `2` = lost. |
| `race_result_array[i].current_consecutive_win_count` | Win streak including this race; resets to 0 after a loss. |

`popularity_mark_rank_array` is also present but unused.

## A score line

Illustrative example: the ace finishing 1st on a 5-race win streak, 15.75% deck, opponent bonus as in the milkbox session.

```json
{ "raw_score_id": 60, "num": 1, "score": 27460,
  "bonus_array": [
    { "score_bonus_id": 1, "bonus_score": 1000 },
    { "score_bonus_id": 2, "bonus_score": 14385 },
    { "score_bonus_id": 8, "bonus_score": 1575 },
    { "condition_type": 4, "score_rate": 500, "bonus_score": 500 }
  ] }
```

Real entries also carry `condition_value_1` / `condition_value_2`, and the streak entry has its own `score_bonus_id` (4–7).

`score` already includes every bonus:

```
score = base + ace + opponentRating + streak + supportCard
```

The base is not stored; it is `score − Σ bonus_score`. Bonus types in `bonus_array`:

| Bonus | How to identify | Amount |
|---|---|---|
| Ace | `score_bonus_id === 1` | 10% of base. Only the ace (`team_member_id` 1). |
| Opponent rating | `score_bonus_id === 2` | `ceil(base × r)`, one rate `r` per session, scaling with the opponent's rating. Applied to base only. |
| Support card | `score_bonus_id === 8` | `ceil(base × support_card_bonus / 10000)`. Already included in `score`; do **not** re-apply the percentage. |
| Win streak | `condition_type === 4` (`score_bonus_id` 4–7) | `base × streak%`, where `score_rate = streak × 100`. Present from the 2nd consecutive win. |

Rushed penalties (IDs 23 / 24) never receive bonuses.

## Score IDs

| ID | Meaning | Base |
|---|---|---|
| 60–71 | Finish position 1st–12th | 1st 10000, 2nd 8000, 3rd 7000, 4th 6000, 5th 5000, 6th–7th 4000, 8th–9th 3000, 10th–12th 2000 |
| 1–18 | Win margin in lengths (lower ID = wider margin); race winner only | `(28 − ID) × 100` |
| 19 / 20 / 21 | Win margin: nose / head / neck | 5000 / 3000 / 2000 |
| 22 | Long Shot: top-3 finish at popularity 8 or lower | 4000 |
| 23 | Rushed (flat) | −500 |
| 24 | Rushed, per second (`num` = seconds) | `−100 × num` |
| 25 | Strong start | 1000 |
| 40–45 | Unique skill, rarity-4 uma; ID = `40 + (6 − level)` | `2000 + 100 × level` |
| 50–55 | Unique skill, rarity-5 uma; ID = `50 + (6 − level)` | `2000 + 100 × level` |
| 56 | Gold skill (`num` = activations) | 1200 each |
| 57 | Regular skill (`num` = activations) | 500 each |
| 58 / 59 | Good mid-race / late-race position | 1000 |
| 72–91 | Beat the course's target time | `(92 − ID) × 100` |
| 94 (team) | All Members Podiumed: all three player umas finish 1st–3rd | 5000 |
| 95 (team) | All Members Placed: all three player umas finish 1st–5th (not awarded with 94) | 4000 |

## Session total and the victory bonus

A session is 5 races. The in-game session total is:

```
Σ team_total_score (5 races) + victory bonus (if 3+ races won)
```

The **victory bonus is not stored in the file**. It is a flat amount, regardless of whether you won 3, 4 or 5 races:

```
10000 + ceil(10000 × r)
```

Here `r` is the session's opponent-rating rate. No support card, streak or ace bonus applies. The opponent part equals the opponent bonus on any 10,000-base line in the session (Finish 1st), so the parser copies it from there. If no such line exists, it estimates `r` from the other lines.

Count race wins with `win_type === 1`. This always agreed with "best player placement beats best opponent placement" in the files checked.

## How the app models it

| File | Role |
|---|---|
| `src/analytics/scoreIds.ts` | All score ID constants and range helpers, plus victory constants. |
| `src/parsers/teamTrials.ts` | `buildScoreEvents` splits each line into `baseScore` and `bonusScores` (`ace`, `opponentRating`, `streak`, `supportCard`). `buildVictoryBonus` synthesizes `TTSession.victoryBonus` (ID 0). `playerWonRound` comes from `win_type`. |
| `src/utils/teamTrialScore.ts` | The single score model. `scoreEventValue`, `umaScore`, `roundScore`, `sessionScore` take a `ScoreBonusSettings`. `inGameRoundScore` / `inGameSessionScore` always return the exact in-game numbers. |
| `src/analytics/aggregateTeamTrials.ts`, `umaComparison.ts`, `scoreBreakdown.ts` | Analytics. All scoring goes through `teamTrialScore.ts`; do not reimplement bonus math elsewhere. |

What each scope counts:

- **Uma score:** that uma's own lines only. Team events can't be attributed to one uma.
- **Race score:** all three player umas plus team events (94 / 95).
- **Session score:** five race scores plus the victory bonus.

### Score bonus settings

Settings → Score Bonuses has four checkboxes, one per bonus type, stored in localStorage under `team-umalysis-score-bonuses`. They apply uniformly to every analytics view; there are no per-view exceptions.

- **All off** (`BASE_SCORE_ONLY`, the default) compares raw performance without opponent, streak, deck or ace effects.
- **All on** (`IN_GAME_SCORE`) reproduces in-game numbers exactly.

The replay list, per-race labels and the session index always use the in-game functions. Score cards show an "In-Game Avg" line whenever the selected settings produce a different average.

## Verifying changes

There is no test suite. To check scoring against real data:

1. Bundle a small Node harness with the esbuild that ships with Vite (`node_modules/vite/node_modules/esbuild`).
2. Have the harness import `parseTeamTrialSession` and the `teamTrialScore.ts` functions.
3. Run it over the Team Trials folder and check:
   - `roundScore(round, IN_GAME_SCORE) === round.teamTotalScore` for every race;
   - `baseScore + Σ bonusScores === score` for every line;
   - `inGameSessionScore` matches known in-game totals.

Reference in-game totals:

| File | Opponent | Result | In-game total |
|---|---|---|---|
| `TT-20261018_013341_099.json` | milkbox | 5–0 | 895,900 |
| `TT-20261018_013317_941.json` | MinotaurZombie | 5–0 | 885,222 |
| `TT-20261017_013558_036.json` | Zeke | 3–2 | 819,098 |
| `TT-20261017_013544_003.json` | Schnarf | 1–4 (no victory bonus) | 744,403 |
| `TT-20261015_133509_677.json` | Mizumi0316 | 2–3 (no victory bonus) | 826,555 |

## Known gaps

- The exact formula linking `opponent_evaluate` to the opponent-rating rate `r` hasn't been worked out. The app never needs it, because the bonus amounts are read from the file.
- Ace and streak bonuses are rounded to an integer, but whether they round up or down is unconfirmed (both fit the data).
- `scoreBreakdown.ts` has a fallback for when a unique skill activates in the replay but no unique score line exists: it estimates `2000 + 100 × level` and ignores the bonus settings. It is unclear whether this case occurs with current files.
