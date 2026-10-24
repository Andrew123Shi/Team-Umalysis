import { useCallback, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type TipRow = { label: ReactNode; value: ReactNode; color?: string };

export type TipContent = {
    head?: ReactNode;
    /** Swatch shown next to the head. */
    color?: string;
    rows?: TipRow[];
    note?: ReactNode;
};

type TipState = { content: TipContent; x: number; y: number };

const CURSOR_OFFSET = 14;
/** Past this distance from the right/bottom edge the tip flips to the other side of the cursor. */
const FLIP_MARGIN_X = 280;
const FLIP_MARGIN_Y = 160;

export function TipBody({ content }: { content: TipContent }) {
    return (
        <>
            {content.head !== undefined && (
                <div className="chart-tip-head hover-tip-head">
                    {content.color && <span className="hover-tip-swatch" style={{ background: content.color }} />}
                    {content.head}
                </div>
            )}
            {content.rows?.map((row, index) => (
                <div key={index} className="chart-tip-row">
                    <span>
                        {row.color && <span className="hover-tip-swatch" style={{ background: row.color }} />}
                        {row.label}
                    </span>
                    <b>{row.value}</b>
                </div>
            ))}
            {content.note !== undefined && <div className="chart-tip-note">{content.note}</div>}
        </>
    );
}

/**
 * Instant cursor-following tooltip styled like the chart tooltips, for plain
 * DOM plots. Spread `bind(content)` onto the hover target and render `tip`.
 */
export function useHoverTip() {
    const [state, setState] = useState<TipState | null>(null);

    const bind = useCallback((content: TipContent | undefined) => {
        if (!content) return {};
        const show = (event: MouseEvent<Element>) => setState({ content, x: event.clientX, y: event.clientY });
        return {
            onMouseEnter: show,
            onMouseMove: show,
            onMouseLeave: () => setState(null),
        };
    }, []);

    let tip: ReactNode = null;
    if (state && typeof document !== 'undefined') {
        const flipX = state.x > window.innerWidth - FLIP_MARGIN_X;
        const flipY = state.y > window.innerHeight - FLIP_MARGIN_Y;
        const style = {
            left: flipX ? state.x - CURSOR_OFFSET : state.x + CURSOR_OFFSET,
            top: flipY ? state.y - CURSOR_OFFSET : state.y + CURSOR_OFFSET,
            transform: `translate(${flipX ? '-100%' : '0'}, ${flipY ? '-100%' : '0'})`,
        } as CSSProperties;
        tip = createPortal(
            <div className="hover-tip" style={style} role="tooltip">
                <TipBody content={state.content} />
            </div>,
            document.body,
        );
    }

    return { bind, tip };
}
