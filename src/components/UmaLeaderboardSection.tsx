import { useMemo, useState } from 'react';
import { Button, ButtonGroup, Col, Row } from 'react-bootstrap';

import { buildUmaComparisonEntries } from '../analytics/umaComparison';
import type { TTSession } from '../analytics/types';
import UmaRankTable, {
    fmtAvgActivationRow,
    fmtNormScoreRow,
    fmtRateRow,
    fmtWinMarginRow,
    fmtWinRateRow,
    sortEntries,
} from './UmaRankTable';

type UmaLeaderboardSectionProps = {
    sessions: TTSession[];
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

export default function UmaLeaderboardSection({ sessions, onSelectUma }: UmaLeaderboardSectionProps) {
    const [rosterOnly, setRosterOnly] = useState(true);

    const entries = useMemo(
        () => buildUmaComparisonEntries(sessions, { rosterOnly }),
        [sessions, rosterOnly],
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
    }), [entries]);

    return (
        <>
            <div className="d-flex flex-wrap align-items-center justify-content-end gap-2 mb-3">
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
            </div>

            <Row className="g-3 mb-2">
                    <Col lg={3} md={6}>
                        <UmaRankTable
                            title="Top Performers by Win Rate"
                            rows={primaryTables.topWinRate}
                            valueColumnLabel="Win Rate"
                            defaultSortKey="value"
                            defaultSortDir="desc"
                            collapsible={!rosterOnly}
                            onSelectUma={onSelectUma}
                        />
                    </Col>
                    <Col lg={3} md={6}>
                        <UmaRankTable
                            title="Underperformers by Win Rate"
                            rows={primaryTables.underWinRate}
                            valueColumnLabel="Win Rate"
                            defaultSortKey="value"
                            defaultSortDir="asc"
                            collapsible={!rosterOnly}
                            onSelectUma={onSelectUma}
                        />
                    </Col>
                    <Col lg={3} md={6}>
                        <UmaRankTable
                            title="Top Performers by Normalized Score"
                            rows={primaryTables.topNormScore}
                            valueColumnLabel="Score"
                            defaultSortKey="value"
                            defaultSortDir="desc"
                            collapsible={!rosterOnly}
                            onSelectUma={onSelectUma}
                        />
                    </Col>
                    <Col lg={3} md={6}>
                        <UmaRankTable
                            title="Underperformers by Normalized Score"
                            rows={primaryTables.underNormScore}
                            valueColumnLabel="Score"
                            defaultSortKey="value"
                            defaultSortDir="asc"
                            collapsible={!rosterOnly}
                            onSelectUma={onSelectUma}
                        />
                    </Col>
                </Row>

                <Row className="g-3 mb-2">
                    <Col lg={3} md={6}>
                        <UmaRankTable
                            title="Top Average Win Margins"
                            rows={metricTables.winMargin}
                            valueColumnLabel="Average Margin"
                            defaultSortKey="value"
                            defaultSortDir="desc"
                            collapsible={!rosterOnly}
                            onSelectUma={onSelectUma}
                        />
                    </Col>
                    <Col lg={3} md={6}>
                        <UmaRankTable
                            title="Top % of Strong Starts"
                            rows={metricTables.strongStart}
                            valueColumnLabel="Rate"
                            defaultSortKey="value"
                            defaultSortDir="desc"
                            collapsible={!rosterOnly}
                            onSelectUma={onSelectUma}
                        />
                    </Col>
                    <Col lg={3} md={6}>
                        <UmaRankTable
                            title="Top Good Mid-Race Positioning"
                            rows={metricTables.goodMid}
                            valueColumnLabel="Rate"
                            defaultSortKey="value"
                            defaultSortDir="desc"
                            collapsible={!rosterOnly}
                            onSelectUma={onSelectUma}
                        />
                    </Col>
                    <Col lg={3} md={6}>
                        <UmaRankTable
                            title="Top Good Late-Race Positioning"
                            rows={metricTables.goodLate}
                            valueColumnLabel="Rate"
                            defaultSortKey="value"
                            defaultSortDir="desc"
                            collapsible={!rosterOnly}
                            onSelectUma={onSelectUma}
                        />
                    </Col>
                </Row>

                <Row className="g-3">
                    <Col lg={3} md={6}>
                        <UmaRankTable
                            title="Top Unique Skill Activations"
                            rows={metricTables.uniqueSkills}
                            valueColumnLabel="Rate"
                            defaultSortKey="value"
                            defaultSortDir="desc"
                            collapsible={!rosterOnly}
                            onSelectUma={onSelectUma}
                        />
                    </Col>
                    <Col lg={3} md={6}>
                        <UmaRankTable
                            title="Top Gold Skill Activations"
                            rows={metricTables.goldSkills}
                            valueColumnLabel="Average"
                            defaultSortKey="value"
                            defaultSortDir="desc"
                            collapsible={!rosterOnly}
                            onSelectUma={onSelectUma}
                        />
                    </Col>
                    <Col lg={3} md={6}>
                        <UmaRankTable
                            title="Top Regular Skill Activations"
                            rows={metricTables.regSkills}
                            valueColumnLabel="Average"
                            defaultSortKey="value"
                            defaultSortDir="desc"
                            collapsible={!rosterOnly}
                            onSelectUma={onSelectUma}
                        />
                    </Col>
                    <Col lg={3} md={6}>
                        <UmaRankTable
                            title="Top Target Time Beaters"
                            rows={metricTables.beatTarget}
                            valueColumnLabel="Rate"
                            defaultSortKey="value"
                            defaultSortDir="desc"
                            collapsible={!rosterOnly}
                            onSelectUma={onSelectUma}
                        />
                    </Col>
                    <Col lg={3} md={6}>
                        <UmaRankTable
                            title="Least Rushed Occurrence"
                            rows={metricTables.leastRushed}
                            valueColumnLabel="Rate"
                            defaultSortKey="value"
                            defaultSortDir="asc"
                            collapsible={!rosterOnly}
                            onSelectUma={onSelectUma}
                        />
                    </Col>
            </Row>
        </>
    );
}
