import { useMemo, useState } from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';

import { buildUmaComparisonEntries } from '../analytics/umaComparison';
import type { ScoreBonusSettings, TTSession } from '../analytics/types';
import SectionHeading from './SectionHeading';
import UmaRankTable, {
    type UmaRankRow,
    fmtAvgActivationRow,
    fmtNormScoreRow,
    fmtRateRow,
    fmtWinMarginRow,
    fmtWinRateRow,
    sortEntries,
} from './UmaRankTable';

type UmaLeaderboardSectionProps = {
    sessions: TTSession[];
    scoreBonuses: ScoreBonusSettings;
    onSelectUma?: (buildKey: string) => void;
};

function buildRows<T extends ReturnType<typeof fmtWinRateRow>>(
    entries: ReturnType<typeof buildUmaComparisonEntries>,
    getValue: (entry: (typeof entries)[number]) => number,
    direction: 'asc' | 'desc',
    mapRow: (entry: (typeof entries)[number]) => T,
) {
    return sortEntries(entries, getValue, direction).map(mapRow);
}

export default function UmaLeaderboardSection({ sessions, scoreBonuses, onSelectUma }: UmaLeaderboardSectionProps) {
    const [rosterOnly, setRosterOnly] = useState(true);

    const entries = useMemo(
        () => buildUmaComparisonEntries(sessions, { rosterOnly, scoreBonuses }),
        [sessions, rosterOnly, scoreBonuses],
    );

    const primaryTables = useMemo(() => ({
        topWinRate: buildRows(entries, (e) => e.winRate, 'desc', fmtWinRateRow),
        underWinRate: buildRows(entries, (e) => e.winRate, 'asc', fmtWinRateRow),
        topNormScore: buildRows(entries, (e) => e.avgNormalizedScore, 'desc', fmtNormScoreRow),
        underNormScore: buildRows(entries, (e) => e.avgNormalizedScore, 'asc', fmtNormScoreRow),
    }), [entries]);

    const metricTables = useMemo(() => ({
        winMargin: buildRows(
            entries.filter((e) => e.scoreBreakdown.winMarginLengthCount > 0),
            (e) => e.scoreBreakdown.avgWinMarginLengths,
            'desc',
            fmtWinMarginRow,
        ),
        strongStart: buildRows(
            entries,
            (e) => e.scoreBreakdown.strongStartRate,
            'desc',
            (e) => fmtRateRow(e, e.scoreBreakdown.strongStartRate),
        ),
        goodMid: buildRows(
            entries,
            (e) => e.scoreBreakdown.goodMidPositionRate,
            'desc',
            (e) => fmtRateRow(e, e.scoreBreakdown.goodMidPositionRate),
        ),
        goodLate: buildRows(
            entries,
            (e) => e.scoreBreakdown.goodLatePositionRate,
            'desc',
            (e) => fmtRateRow(e, e.scoreBreakdown.goodLatePositionRate),
        ),
        uniqueSkills: buildRows(
            entries,
            (e) => e.totalUniqueSkillChances > 0
                ? e.totalUniqueSkillActivations / e.totalUniqueSkillChances
                : 0,
            'desc',
            (e) => fmtRateRow(
                e,
                e.totalUniqueSkillChances > 0
                    ? e.totalUniqueSkillActivations / e.totalUniqueSkillChances
                    : 0,
            ),
        ),
        goldSkills: buildRows(
            entries,
            (e) => e.avgGoldSkillActivations,
            'desc',
            (e) => fmtAvgActivationRow(
                e,
                e.totalGoldSkillActivations,
                e.totalGoldSkillChances,
                e.avgGoldSkillActivations,
            ),
        ),
        regSkills: buildRows(
            entries,
            (e) => e.avgRegularSkillActivations,
            'desc',
            (e) => fmtAvgActivationRow(
                e,
                e.totalRegularSkillActivations,
                e.totalRegularSkillChances,
                e.avgRegularSkillActivations,
            ),
        ),
        beatTarget: buildRows(
            entries,
            (e) => e.scoreBreakdown.beatTargetTimeRate,
            'desc',
            (e) => fmtRateRow(e, e.scoreBreakdown.beatTargetTimeRate),
        ),
        leastRushed: buildRows(
            entries,
            (e) => e.scoreBreakdown.rushedOccurrenceRate,
            'asc',
            (e) => fmtRateRow(e, e.scoreBreakdown.rushedOccurrenceRate),
        ),
        longShot: buildRows(
            entries,
            (e) => e.scoreBreakdown.longShotRate,
            'desc',
            (e) => fmtRateRow(e, e.scoreBreakdown.longShotRate),
        ),
    }), [entries]);

    const tables: { title: string; info?: string; rows: UmaRankRow[]; valueLabel: string; dir: 'asc' | 'desc' }[] = [
        { title: 'Top Performers by Win Rate', rows: primaryTables.topWinRate, valueLabel: 'Win %', dir: 'desc' },
        { title: 'Underperformers by Win Rate', rows: primaryTables.underWinRate, valueLabel: 'Win %', dir: 'asc' },
        { title: 'Top Performers by Score', rows: primaryTables.topNormScore, valueLabel: 'Score', dir: 'desc' },
        { title: 'Underperformers by Score', rows: primaryTables.underNormScore, valueLabel: 'Score', dir: 'asc' },
        { title: 'Top Average Win Margins', rows: metricTables.winMargin, valueLabel: 'Margin', dir: 'desc' },
        { title: 'Top % of Strong Starts', rows: metricTables.strongStart, valueLabel: 'Rate', dir: 'desc' },
        { title: 'Top Good Mid-Race Positioning', rows: metricTables.goodMid, valueLabel: 'Rate', dir: 'desc' },
        { title: 'Top Good Late-Race Positioning', rows: metricTables.goodLate, valueLabel: 'Rate', dir: 'desc' },
        { title: 'Top Unique Skill Activations', rows: metricTables.uniqueSkills, valueLabel: 'Rate', dir: 'desc' },
        { title: 'Top Gold Skill Activations', rows: metricTables.goldSkills, valueLabel: 'Avg', dir: 'desc' },
        { title: 'Top Regular Skill Activations', rows: metricTables.regSkills, valueLabel: 'Avg', dir: 'desc' },
        { title: 'Top Target Time Beaters', rows: metricTables.beatTarget, valueLabel: 'Rate', dir: 'desc' },
        { title: 'Least Rushed Occurrence', rows: metricTables.leastRushed, valueLabel: 'Rate', dir: 'asc' },
        {
            title: 'Darkest Horses',
            info: 'Highest Long Shot Bonus Rates',
            rows: metricTables.longShot,
            valueLabel: 'Rate',
            dir: 'desc',
        },
    ];

    return (
        <section className="analytics-section">
            <SectionHeading
                level="section"
                title="Uma Comparison"
                actions={(
                    <ButtonGroup size="sm">
                        <Button
                            variant={rosterOnly ? 'secondary' : 'outline-secondary'}
                            onClick={() => setRosterOnly(true)}
                        >
                            Current Roster
                        </Button>
                        <Button
                            variant={!rosterOnly ? 'secondary' : 'outline-secondary'}
                            onClick={() => setRosterOnly(false)}
                        >
                            All Historical
                        </Button>
                    </ButtonGroup>
                )}
            />

            <div className="leaderboard-grid">
                {tables.map((table) => (
                    <UmaRankTable
                        key={table.title}
                        title={table.title}
                        info={table.info}
                        rows={table.rows}
                        valueColumnLabel={table.valueLabel}
                        defaultSortKey="value"
                        defaultSortDir={table.dir}
                        collapsible={!rosterOnly}
                        onSelectUma={onSelectUma}
                    />
                ))}
            </div>
        </section>
    );
}
