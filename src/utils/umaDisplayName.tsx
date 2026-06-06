import UMDatabaseWrapper from '../data/UMDatabaseWrapper';

/** Card (racewear) name + character name, matching matchup table labels. */
export function formatUmaDisplayName(charaName: string, cardId: number): string {
    const cardName = UMDatabaseWrapper.cards[cardId]?.name;
    return cardName ? `${cardName} ${charaName}` : charaName;
}

export function UmaDisplayName({
    charaName,
    cardId,
    className,
}: {
    charaName: string;
    cardId: number;
    className?: string;
}) {
    const cardName = UMDatabaseWrapper.cards[cardId]?.name;
    if (!cardName) {
        return <span className={className}>{charaName}</span>;
    }

    return (
        <span className={className}>
            <span className="uma-display-name-card">{cardName}</span>
            {' '}
            <span className="uma-display-name-chara">{charaName}</span>
        </span>
    );
}
