import { useMemo } from 'react';
import type { NumericSummary, RosterUmaSlot } from '../analytics/types';
import { DISTANCE_LABELS, DISTANCE_ORDER } from '../analytics/types';
import { formatScore } from '../utils/formatScore';
import RangeTrack, { FIELD_SIZE, rangeTip } from './charts/RangeTrack';
import { useHoverTip, type TipContent } from './HoverTip';
import { WinRateDonut } from './charts/WinRatePies';
import { StatStrip, UmaIdentity } from './UmaCardParts';

const ROSTER_ROWS = 3;

type ScoreDomain = { min: number; max: number };

function compactScore(value: number): string {
    if (Math.abs(value) < 10_000) return formatScore(value);
    return `${(value / 1000).toFixed(1)}k`;
}

function formatPosition(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function TrackRow({
    label,
    summary,
    format,
    tip,
    domainMin,
    domainMax,
    ticks,
    color,
}: {
    label: string;
    summary: NumericSummary;
    format: (value: number) => string;
    tip: TipContent;
    domainMin: number;
    domainMax: number;
    ticks?: number;
    color?: string;
}) {
    const { bind, tip: tipElement } = useHoverTip();
    return (
        <div className="roster-track-row" {...bind(tip)}>
            {tipElement}
            <span className="roster-track-label">{label}</span>
            <b className="roster-track-end">{format(summary.min)}</b>
            <RangeTrack
                min={summary.min}
                max={summary.max}
                avg={summary.avg}
                median={summary.median}
                domainMin={domainMin}
                domainMax={domainMax}
                ticks={ticks}
                color={color}
            />
            <b className="roster-track-end">{format(summary.max)}</b>
        </div>
    );
}

function UmaRosterMetrics({ uma, scoreDomain }: { uma: RosterUmaSlot; scoreDomain: ScoreDomain }) {
    const { placement, score } = uma;

    if (placement.count === 0) {
        return <div className="roster-metrics-empty">No race data</div>;
    }

    return (
        <div className="roster-metrics">
            <div className="roster-metrics-top">
                <WinRateDonut value={uma.winRate} size="sm" />
                <div className="roster-figures">
                    <div className="roster-fig has-row-labels">
                        <span />
                        <span className="roster-fig-head">Score</span>
                        <span className="roster-fig-row-label">Avg</span>
                        <b>{formatScore(score.avg)}</b>
                        <span className="roster-fig-row-label">Med</span>
                        <b className="is-median">{formatScore(score.median)}</b>
                    </div>
                    <div className="roster-fig">
                        <span className="roster-fig-head">Pos</span>
                        <b>{placement.avg.toFixed(2)}</b>
                        <b className="is-median">{formatPosition(placement.median)}</b>
                    </div>
                    <div className="roster-fig is-single">
                        <span className="roster-fig-head">Races</span>
                        <b>{placement.count}</b>
                    </div>
                </div>
            </div>
            <div className="roster-tracks">
                <TrackRow
                    label="Pos"
                    summary={placement}
                    format={formatPosition}
                    tip={rangeTip('Finishing Position', placement, formatPosition, {
                        minLabel: 'Best',
                        maxLabel: 'Worst',
                        avgFormat: (value) => value.toFixed(2),
                    })}
                    domainMin={1}
                    domainMax={FIELD_SIZE}
                    ticks={FIELD_SIZE}
                />
                <TrackRow
                    label="Score"
                    summary={score}
                    format={compactScore}
                    tip={rangeTip('Race Score', score, formatScore, { color: '#4d9fff' })}
                    domainMin={scoreDomain.min}
                    domainMax={scoreDomain.max}
                    color="#4d9fff"
                />
            </div>
        </div>
    );
}

function UmaRosterCard({
    uma,
    scoreDomain,
    onSelect,
}: {
    uma: RosterUmaSlot;
    scoreDomain: ScoreDomain;
    onSelect?: (buildKey: string) => void;
}) {
    return (
        <div
            className={`app-card uma-roster-card${onSelect ? ' is-clickable' : ''}`}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            onClick={onSelect ? () => onSelect(uma.buildKey) : undefined}
            onKeyDown={onSelect ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(uma.buildKey);
                }
            } : undefined}
        >
            <UmaIdentity
                cardId={uma.cardId}
                charaName={uma.charaName}
                rankScore={uma.rankScore}
                starCount={uma.starCount}
                runningStyle={uma.runningStyle}
            />
            <StatStrip stats={uma.stats} totalSkillPoints={uma.totalSkillPoints} compact />
            <UmaRosterMetrics uma={uma} scoreDomain={scoreDomain} />
        </div>
    );
}

export default function UmaRosterSummary({
    rosterGrid,
    onSelectUma,
}: {
    rosterGrid: (RosterUmaSlot | null)[][];
    onSelectUma?: (buildKey: string) => void;
}) {
    // Score whiskers share one roster-wide domain so tiles compare at a glance.
    const scoreDomain = useMemo<ScoreDomain>(() => {
        const withData = rosterGrid.flat().filter((uma): uma is RosterUmaSlot => !!uma && uma.score.count > 0);
        if (withData.length === 0) return { min: 0, max: 1 };
        return {
            min: Math.min(...withData.map((uma) => uma.score.min)),
            max: Math.max(...withData.map((uma) => uma.score.max)),
        };
    }, [rosterGrid]);

    return (
        <div className="uma-roster">
            <div className="uma-roster-grid">
                {DISTANCE_ORDER.map((distanceType, colIdx) => {
                    const column = rosterGrid[colIdx] ?? [];
                    return (
                        <div key={distanceType} className="uma-roster-col">
                            <div className="uma-roster-col-head">
                                <span className="uma-roster-col-title">{DISTANCE_LABELS[distanceType]}</span>
                            </div>
                            <div className="uma-roster-slots">
                                {Array.from({ length: ROSTER_ROWS }, (_, rowIdx) => {
                                    const uma = column[rowIdx];
                                    return uma
                                        ? <UmaRosterCard key={rowIdx} uma={uma} scoreDomain={scoreDomain} onSelect={onSelectUma} />
                                        : <div key={rowIdx} className="uma-roster-empty">Empty slot</div>;
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
