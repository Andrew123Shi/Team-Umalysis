import { Fragment } from 'react';
import { Dropdown } from 'react-bootstrap';

import type { UmaComparisonEntry } from '../analytics/types';
import { DISTANCE_LABELS, DISTANCE_ORDER } from '../analytics/types';
import UMDatabaseWrapper from '../data/UMDatabaseWrapper';
import RatingDisplay from './RatingDisplay';
import StatDisplay from './StatDisplay';

function formatRetiredDate(timestamp: number | null): string {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
}

function HistoricalUmaOptionLabel({ uma }: { uma: UmaComparisonEntry }) {
    const outfitName = UMDatabaseWrapper.cards[uma.cardId]?.name;

    return (
        <span className="historical-uma-option">
            {outfitName && (
                <>
                    <span className="historical-uma-option-outfit">{outfitName}</span>
                    <span className="historical-uma-option-sep"> </span>
                </>
            )}
            <span className="historical-uma-option-chara">{uma.charaName}</span>
            <span className="historical-uma-option-sep"> · </span>
            <RatingDisplay rankScore={uma.rankScore} />
            <span className="historical-uma-option-sep"> · </span>
            <StatDisplay stats={uma.stats} className="historical-uma-option-stats" separator="slash" />
            <span className="historical-uma-option-sep"> · </span>
            <span>{uma.appearances} Races</span>
            <span className="historical-uma-option-sep"> · </span>
            <span>Retired {formatRetiredDate(uma.lastSeenAt)}</span>
        </span>
    );
}

type HistoricalUmaSelectProps = {
    historicalUmas: UmaComparisonEntry[];
    selectedBuildKey: string;
    placeholder: string;
    onSelect: (buildKey: string) => void;
    onClear: () => void;
};

export default function HistoricalUmaSelect({
    historicalUmas,
    selectedBuildKey,
    placeholder,
    onSelect,
    onClear,
}: HistoricalUmaSelectProps) {
    const selectedUma = historicalUmas.find((uma) => uma.buildKey === selectedBuildKey) ?? null;
    const groupedByDistance = DISTANCE_ORDER
        .map((distanceType) => ({
            distanceType,
            label: DISTANCE_LABELS[distanceType],
            umas: historicalUmas.filter((uma) => uma.distanceType === distanceType),
        }))
        .filter((group) => group.umas.length > 0);

    return (
        <Dropdown className="historical-uma-select w-100">
            <Dropdown.Toggle
                variant="outline-secondary"
                className="historical-uma-select-toggle w-100 text-start"
            >
                {selectedUma ? <HistoricalUmaOptionLabel uma={selectedUma} /> : placeholder}
            </Dropdown.Toggle>
            <Dropdown.Menu
                className="historical-uma-select-menu w-100"
                popperConfig={{ strategy: 'fixed' }}
                renderOnMount
            >
                <Dropdown.Item
                    active={!selectedBuildKey}
                    onClick={onClear}
                >
                    {placeholder}
                </Dropdown.Item>
                {groupedByDistance.map((group) => (
                    <Fragment key={group.distanceType}>
                        <Dropdown.Header className="historical-uma-select-group">
                            {group.label}
                        </Dropdown.Header>
                        {group.umas.map((uma) => (
                            <Dropdown.Item
                                key={uma.buildKey}
                                active={uma.buildKey === selectedBuildKey}
                                onClick={() => onSelect(uma.buildKey)}
                            >
                                <HistoricalUmaOptionLabel uma={uma} />
                            </Dropdown.Item>
                        ))}
                    </Fragment>
                ))}
            </Dropdown.Menu>
        </Dropdown>
    );
}
