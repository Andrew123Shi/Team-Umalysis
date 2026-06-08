import { Card, OverlayTrigger, Table, Tooltip } from 'react-bootstrap';

import type { ScoreBreakdownSummary } from '../../analytics/types';
import SectionHeading from '../SectionHeading';
import { formatScore } from '../../utils/formatScore';

type Row = {
    label: string;
    value: string;
    score: string;
    detail?: string;
};

function fmtPct(value: number) {
    return `${(value * 100).toFixed(1)}%`;
}

function fmtPlacement(value: number) {
    return value.toFixed(2);
}

function fmtLengths(value: number) {
    return `${value.toFixed(2)} Lengths`;
}

function fmtInWins(value: string, wins: number) {
    return `${value} in ${wins} Wins`;
}

function fmtActivationsWithRate(avg: number, rate: number) {
    return `${avg.toFixed(2)} / ${(rate * 100).toFixed(1)}%`;
}

function fmtSeconds(value: number) {
    const rounded = Math.round(value * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} s`;
}

function InfoIcon({ id, tip }: { id: string; tip: string }) {
    return (
        <OverlayTrigger
            placement="top"
            overlay={<Tooltip id={id}>{tip}</Tooltip>}
        >
            <span className="score-breakdown-info ms-1" aria-label="More info">ⓘ</span>
        </OverlayTrigger>
    );
}

export default function ScoreBreakdownPanel({ breakdown }: { breakdown: ScoreBreakdownSummary }) {
    const rows: Row[] = [
        {
            label: 'Average Finish Position',
            value: fmtPlacement(breakdown.avgFinishOrder),
            score: formatScore(breakdown.avgFinishPositionScore),
            detail: 'Average placement and base points from final position',
        },
        {
            label: 'Win Margin for Wins',
            value: breakdown.winMarginWinCount > 0
                ? fmtInWins(fmtLengths(breakdown.avgWinMarginLengths), breakdown.winMarginWinCount)
                : '—',
            score: breakdown.winMarginWinCount > 0
                ? fmtInWins(formatScore(breakdown.avgWinMarginBonus), breakdown.winMarginWinCount)
                : '—',
            detail: 'Distance to 2nd place for wins and base points from the winning margin',
        },
        {
            label: 'Strong Start Rate',
            value: fmtPct(breakdown.strongStartRate),
            score: formatScore(breakdown.avgStrongStartBonus),
            detail: 'Share of races with strong start bonus',
        },
        {
            label: 'Good Positioning Rate, Mid-Race',
            value: fmtPct(breakdown.goodMidPositionRate),
            score: formatScore(breakdown.avgGoodMidPositionBonus),
            detail: 'Share of races with the good mid-race positioning bonus',
        },
        {
            label: 'Good Positioning Rate, Late-Race',
            value: fmtPct(breakdown.goodLatePositionRate),
            score: formatScore(breakdown.avgGoodLatePositionBonus),
            detail: 'Share of races with the good late-race positioning bonus',
        },
        {
            label: 'Unique Skill Activation Rate',
            value: fmtPct(breakdown.uniqueSkillActivationRate),
            score: formatScore(breakdown.avgUniqueSkillPoints),
            detail: 'Percent of learned unique skills that activated',
        },
        {
            label: 'Gold Skill Activations, per Race',
            value: fmtActivationsWithRate(
                breakdown.avgGoldSkillActivations,
                breakdown.goldSkillActivationRate,
            ),
            score: formatScore(breakdown.avgGoldSkillPoints),
            detail: 'Average number of activations and percent of total learned gold skills actually activated',
        },
        {
            label: 'Regular Skill Activations, per Race',
            value: fmtActivationsWithRate(
                breakdown.avgRegularSkillActivations,
                breakdown.regularSkillActivationRate,
            ),
            score: formatScore(breakdown.avgRegularSkillPoints),
            detail: 'Average number of activations and percent of total learned regular skills actually activated',
        },
        {
            label: 'Target Time Beat Rate',
            value: fmtPct(breakdown.beatTargetTimeRate),
            score: formatScore(breakdown.avgBeatTargetTimeBonus),
            detail: 'Share of races beating the Reference Time',
        },
        {
            label: 'Rushed Occurence Rate',
            value: fmtPct(breakdown.rushedOccurrenceRate),
            score: formatScore(breakdown.avgRushedPenalty),
            detail: 'Share of races where the uma was Rushed',
        },
        {
            label: 'Average Rushed Duration',
            value: breakdown.rushedDurationCount > 0
                ? fmtSeconds(breakdown.avgRushedDurationSeconds)
                : '—',
            score: breakdown.rushedDurationCount > 0
                ? formatScore(breakdown.avgRushedDurationPenalty)
                : '—',
            detail: 'Average Rushed duration and point penalty from Rushed duration only (excluding the -500 base Rushed penalty)',
        },
    ];

    return (
        <Card className="app-card h-100 score-breakdown-panel">
            <Card.Body className="d-flex flex-column">
                <SectionHeading
                    title="General Performance"
                    compact
                    className="mt-0 mb-3"
                />
                <div className="table-responsive">
                    <Table className="table table-sm table-hover stats-table score-breakdown-table mb-0">
                        <colgroup>
                            <col />
                            <col className="stats-col-num-wide" />
                            <col className="stats-col-num-wide" />
                        </colgroup>
                        <thead>
                            <tr>
                                <th className="stats-col-label" aria-hidden="true" />
                                <th className="stats-col-value">Result</th>
                                <th className="stats-col-value">Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.label}>
                                    <td className="stats-col-label">
                                        {row.label}
                                        {row.detail && (
                                            <InfoIcon id={`score-breakdown-${row.label}`} tip={row.detail} />
                                        )}
                                    </td>
                                    <td className="stats-col-value">{row.value}</td>
                                    <td className="stats-col-value">{row.score}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            </Card.Body>
        </Card>
    );
}
