import { useMemo } from 'react';
import type { ScoreBreakdownSummary } from '../../analytics/types';
import SectionHeading from '../SectionHeading';
import InfoTip from '../InfoTip';
import { formatScore } from '../../utils/formatScore';
import { CHART_COLORS } from './chartTheme';
import HistogramTip, { type HistogramSeries } from './HistogramTip';
import { FIELD_SIZE } from './RangeTrack';
import { PLACE_COLORS, ordinal } from './StatCards';

type Row = {
    label: string;
    value: string;
    /** Omitted for rows that award no points. */
    score?: string;
    detail?: string;
    negative?: boolean;
    histogram?: HistogramSeries[];
};

function fmtPct(value: number) {
    return `${(value * 100).toFixed(1)}%`;
}

function fmtPlacement(value: number) {
    return value.toFixed(2);
}

function fmtLengths(value: number) {
    return `${value.toFixed(2)} L`;
}

function fmtActivationsWithRate(avg: number, rate: number) {
    return `${avg.toFixed(2)} · ${(rate * 100).toFixed(1)}%`;
}

function fmtSeconds(value: number) {
    const rounded = Math.round(value * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} s`;
}

function fmtRank(value: number) {
    return Number.isInteger(value) ? ordinal(value) : value.toFixed(1);
}

function fmtCount(value: number) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function fmtActivations(value: number) {
    return `${value} activation${value === 1 ? '' : 's'}`;
}

function pointsSeries(values: number[] | undefined, unit: string, negative = false): HistogramSeries {
    return {
        label: 'Points',
        values: values ?? [],
        format: formatScore,
        unit,
        color: negative ? CHART_COLORS.negative : CHART_COLORS.positive,
    };
}

function buildRows(breakdown: ScoreBreakdownSummary): Row[] {
    const { distributions } = breakdown;
    const hasWinMargin = breakdown.winMarginWinCount > 0;
    const hasRushedDuration = breakdown.rushedDurationCount > 0;
    const skillSeries = (distribution: ScoreBreakdownSummary['distributions']['goldSkills']): HistogramSeries[] => [
        {
            label: 'Result',
            values: distribution.result,
            format: fmtCount,
            unit: 'races',
            discrete: { min: 0, label: fmtActivations },
        },
    ];

    return [
        {
            label: 'Average Finish Position',
            value: fmtPlacement(breakdown.avgFinishOrder),
            score: formatScore(breakdown.avgFinishPositionScore),
            negative: breakdown.avgFinishPositionScore < 0,
            detail: 'Average placement and base points from final position',
            histogram: [
                {
                    label: 'Result',
                    values: distributions.finishPosition.result,
                    format: fmtRank,
                    unit: 'races',
                    discrete: { min: 1, max: FIELD_SIZE, label: ordinal, color: (place) => PLACE_COLORS[place - 1] },
                    minLabel: 'best',
                    maxLabel: 'worst',
                },
                pointsSeries(distributions.finishPosition.points, 'races'),
            ],
        },
        {
            label: 'Win Margin for Wins',
            value: breakdown.winMarginLengthCount > 0 ? fmtLengths(breakdown.avgWinMarginLengths) : '—',
            score: hasWinMargin ? formatScore(breakdown.avgWinMarginBonus) : '—',
            detail: 'Average gap to 2nd place (from replay) and score bonus from the winning margin, averaged over wins',
            histogram: [
                { label: 'Result', values: distributions.winMargin.result, format: fmtLengths, unit: 'wins' },
                pointsSeries(distributions.winMargin.points, 'wins'),
            ],
        },
        {
            label: 'Strong Start Rate',
            value: fmtPct(breakdown.strongStartRate),
            score: formatScore(breakdown.avgStrongStartBonus),
            detail: 'Share of races with strong start bonus',
        },
        {
            label: 'Good Positioning, Mid-Race',
            value: fmtPct(breakdown.goodMidPositionRate),
            score: formatScore(breakdown.avgGoodMidPositionBonus),
            detail: 'Share of races the uma was leading amongst all runners with the same style entering mid-race',
        },
        {
            label: 'Good Positioning, Late-Race',
            value: fmtPct(breakdown.goodLatePositionRate),
            score: formatScore(breakdown.avgGoodLatePositionBonus),
            detail: 'Share of races the uma was leading amongst all runners with the same style entering late-race',
        },
        {
            label: 'Average Popularity',
            value: breakdown.popularityCount > 0 ? fmtPlacement(breakdown.avgPopularity) : '—',
            detail: 'Average favorite rank going into the race, where 1 is the favorite',
            histogram: [
                {
                    label: 'Result',
                    values: distributions.popularity.result,
                    format: fmtRank,
                    unit: 'races',
                    discrete: { min: 1, max: FIELD_SIZE, label: (rank) => `${ordinal(rank)} favorite` },
                },
            ],
        },
        {
            label: 'Long Shot Bonus Rate',
            value: fmtPct(breakdown.longShotRate),
            score: formatScore(breakdown.avgLongShotBonus),
            detail: 'Share of races finishing top 3 as the 8th favorite or lower',
        },
        {
            label: 'Unique Skill Activation',
            value: fmtPct(breakdown.uniqueSkillActivationRate),
            score: formatScore(breakdown.avgUniqueSkillPoints),
            detail: 'Share of races where the unique skill was activated',
        },
        {
            label: 'Gold Skills per Race',
            value: fmtActivationsWithRate(breakdown.avgGoldSkillActivations, breakdown.goldSkillActivationRate),
            score: formatScore(breakdown.avgGoldSkillPoints),
            detail: 'Average number of activations and percent of total learned gold skills actually activated',
            histogram: skillSeries(distributions.goldSkills),
        },
        {
            label: 'Regular Skills per Race',
            value: fmtActivationsWithRate(breakdown.avgRegularSkillActivations, breakdown.regularSkillActivationRate),
            score: formatScore(breakdown.avgRegularSkillPoints),
            detail: 'Average number of activations and percent of total learned regular skills actually activated',
            histogram: skillSeries(distributions.regularSkills),
        },
        {
            label: 'Target Time Beat Rate',
            value: fmtPct(breakdown.beatTargetTimeRate),
            score: formatScore(breakdown.avgBeatTargetTimeBonus),
            detail: 'Share of races beating the Reference Time',
        },
        {
            label: 'Rushed Rate',
            value: fmtPct(breakdown.rushedOccurrenceRate),
            score: formatScore(breakdown.avgRushedPenalty),
            negative: breakdown.avgRushedPenalty < 0,
            detail: 'Share of races where the uma was Rushed',
        },
        {
            label: 'Average Rushed Duration',
            value: hasRushedDuration ? fmtSeconds(breakdown.avgRushedDurationSeconds) : '—',
            score: hasRushedDuration ? formatScore(breakdown.avgRushedDurationPenalty) : '—',
            negative: hasRushedDuration && breakdown.avgRushedDurationPenalty < 0,
            detail: 'Average Rushed duration and point penalty from Rushed duration only (excluding the -500 base Rushed penalty)',
            histogram: [
                { label: 'Result', values: distributions.rushedDuration.result, format: fmtSeconds, unit: 'rushed races' },
                pointsSeries(distributions.rushedDuration.points, 'rushed races', true),
            ],
        },
        {
            label: 'Unique Style',
            value: fmtPct(breakdown.uniqueStyleRate),
            detail: 'Share of races where no other runner has this style',
        },
    ];
}

export default function ScoreBreakdownPanel({ breakdown }: { breakdown: ScoreBreakdownSummary }) {
    const rows = useMemo(() => buildRows(breakdown), [breakdown]);

    return (
        <section className="app-card score-breakdown-panel">
            <SectionHeading title="General Performance" />
            <div className="score-breakdown" role="table">
                <div className="score-breakdown-head" role="row">
                    <span role="columnheader">Category</span>
                    <span role="columnheader">Result</span>
                    <span role="columnheader">Avg points</span>
                </div>
                {rows.map((row) => (
                    <div key={row.label} className="score-breakdown-row" role="row">
                        <span className="score-breakdown-label" role="cell">
                            <span className="score-breakdown-label-text">{row.label}</span>
                            {row.detail && <InfoTip id={`score-breakdown-${row.label}`} tip={row.detail} />}
                        </span>
                        <span className="score-breakdown-result" role="cell">
                            {row.histogram?.some((series) => series.values.length > 0) && (
                                <HistogramTip title={row.label} series={row.histogram} />
                            )}
                            {row.value}
                        </span>
                        <span className={`score-breakdown-score${row.negative ? ' is-negative' : ''}`} role="cell">
                            {row.score}
                        </span>
                    </div>
                ))}
            </div>
        </section>
    );
}
