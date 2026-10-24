import type { ReactNode } from 'react';
import InfoTip from './InfoTip';

export type SectionHeadingLevel = 'section' | 'panel' | 'card';

type SectionHeadingProps = {
    title: string;
    subtitle?: string;
    level?: SectionHeadingLevel;
    className?: string;
    /** Kept for call-site compatibility; panel headings are always compact now. */
    compact?: boolean;
    actions?: ReactNode;
    /** Panel headings only: explanatory text shown from an (i) next to the title. */
    info?: string;
};

export default function SectionHeading({
    title,
    subtitle,
    level = 'panel',
    className = '',
    actions,
    info,
}: SectionHeadingProps) {
    if (level === 'card') {
        return (
            <div className={['panel-label', className].filter(Boolean).join(' ')}>
                {title}
            </div>
        );
    }

    if (level === 'section') {
        return (
            <header className={['section-heading', 'is-section', className].filter(Boolean).join(' ')}>
                <div className="section-heading-text">
                    <h2 className="section-heading-title">{title}</h2>
                    {subtitle && <p className="section-kicker">{subtitle}</p>}
                </div>
                <span className="section-heading-rule" aria-hidden="true" />
                {actions && <div className="section-heading-actions">{actions}</div>}
            </header>
        );
    }

    const titleEl = <h3 className="section-heading-title">{title}</h3>;
    return (
        <div className={['section-heading', 'is-panel', className].filter(Boolean).join(' ')}>
            {info ? (
                <div className="section-heading-main">
                    {titleEl}
                    <InfoTip id={`section-info-${title}`} tip={info} />
                </div>
            ) : titleEl}
            {actions && <div className="section-heading-actions">{actions}</div>}
        </div>
    );
}
