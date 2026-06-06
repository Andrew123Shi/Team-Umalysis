import type { ReactNode } from 'react';

export type SectionHeadingLevel = 'section' | 'panel' | 'card';

type SectionHeadingProps = {
    title: string;
    subtitle?: string;
    level?: SectionHeadingLevel;
    className?: string;
    compact?: boolean;
    actions?: ReactNode;
};

export default function SectionHeading({
    title,
    subtitle,
    level = 'panel',
    className = '',
    compact = false,
    actions,
}: SectionHeadingProps) {
    if (level === 'card') {
        return (
            <div className={['panel-label', className].filter(Boolean).join(' ')}>
                {title}
            </div>
        );
    }

    const headingTag = level === 'section' ? 'h4' : 'h6';
    const wrapperClass = [
        'section-heading',
        level === 'section' ? 'is-section' : 'is-panel',
        compact ? 'is-compact' : '',
        actions ? 'has-actions' : '',
        className,
    ].filter(Boolean).join(' ');

    return (
        <div className={wrapperClass}>
            <div className="section-heading-text">
                {headingTag === 'h4' ? <h4>{title}</h4> : <h6>{title}</h6>}
                {subtitle && <p className="section-kicker">{subtitle}</p>}
            </div>
            {actions}
        </div>
    );
}
