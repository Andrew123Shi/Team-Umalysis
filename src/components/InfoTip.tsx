import { OverlayTrigger, Tooltip } from 'react-bootstrap';

/** Small circled "i" that shows `tip` in a tooltip on hover/focus. */
export default function InfoTip({ id, tip }: { id: string; tip: string }) {
    return (
        <OverlayTrigger placement="top" overlay={<Tooltip id={id}>{tip}</Tooltip>}>
            <span className="info-tip" role="img" aria-label={tip} tabIndex={0}>i</span>
        </OverlayTrigger>
    );
}
