import { useMemo, useState } from 'react';
import { Alert, Button, ButtonGroup, Col, Form, ListGroup, Row, Spinner } from 'react-bootstrap';
import RaceDataPresenter from '../components/RaceDataPresenter';
import { DISTANCE_LABELS, type SessionIndexEntry, type TTRound } from '../analytics/types';
import { getCourseDisplayName } from '../utils/course';
import { formatScore } from '../utils/formatScore';
import { getSessionOpponentTrainer } from '../analytics/umaIdentity';
import { useRaceStore } from '../store/RaceStore';
import SectionHeading from '../components/SectionHeading';

function formatTrialLabel(entry: SessionIndexEntry, opponentTrainerName: string): string {
    const opponent = opponentTrainerName || 'Unknown';
    if (!entry.savedAt) return `Unknown vs. ${opponent}`;
    const d = new Date(entry.savedAt);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy} vs. ${opponent}`;
}

function isSessionVictory(roundsWon: number, roundCount: number): boolean {
    return roundsWon > roundCount / 2;
}

function formatSessionOutcome(entry: SessionIndexEntry): string {
    const won = isSessionVictory(entry.roundsWon, entry.roundCount);
    const label = won ? 'Victory' : 'Loss';
    return `${label} ${entry.roundsWon}/${entry.roundCount} · ${formatScore(entry.totalTeamScore)} pts`;
}

function formatReplayRoundDescription(round: TTRound): string {
    const courseId = round.courseId ?? round.parsedRace.detectedCourseId;
    const sprint = DISTANCE_LABELS[round.distanceType] ?? round.distanceLabel ?? 'Unknown';
    const course = getCourseDisplayName(courseId) ?? 'Unknown';
    return `${sprint} · ${course} · Score ${formatScore(round.teamTotalScore)} · Opp. Rating ${round.opponentEvaluate.toLocaleString()}`;
}

export default function ReplayPage() {
    const { sessions, index, loading, error, progress, hasTriedSavedFolder, loadFromFolder } = useRaceStore();
    const [selectedSessionId, setSelectedSessionId] = useState('');
    const [selectedRound, setSelectedRound] = useState(0);
    const [filter, setFilter] = useState('');

    const opponentTrainerBySessionId = useMemo(
        () => new Map(sessions.map((s) => [s.id, getSessionOpponentTrainer(s)])),
        [sessions],
    );

    const filteredIndex = useMemo(() => {
        const q = filter.trim().toLowerCase();
        if (!q) return index;
        return index.filter((e) => {
            const opponentTrainerName = opponentTrainerBySessionId.get(e.id) ?? e.opponentTrainerName ?? '';
            return e.fileName.toLowerCase().includes(q)
                || e.id.toLowerCase().includes(q)
                || opponentTrainerName.toLowerCase().includes(q)
                || formatTrialLabel(e, opponentTrainerName).toLowerCase().includes(q);
        });
    }, [index, filter, opponentTrainerBySessionId]);

    const session = useMemo(
        () => sessions.find((s) => s.id === selectedSessionId),
        [sessions, selectedSessionId],
    );

    const round = session?.rounds[selectedRound];

    if (loading) {
        return (
            <div className="page-shell">
                <Alert variant="info" className="app-card dashboard-loading-alert">
                    {progress.total > 0 ? `Loading ${progress.loaded}/${progress.total} files...` : 'Loading files...'}
                </Alert>
            </div>
        );
    }
    if (error) {
        return (
            <div className="page-shell">
                <Alert variant="danger">{error}</Alert>
            </div>
        );
    }
    if (!sessions.length) {
        return (
            <div className="page-shell">
                <div className="app-card empty-state">
                    <h2 className="h4">Choose Your Team Trials Folder</h2>
                    <p className="text-muted mb-3">
                        {hasTriedSavedFolder
                            ? 'No Team Trials files are loaded. Select the folder where your Team Trials .json files are stored.'
                            : 'Checking for a saved Team Trials folder...'}
                    </p>
                    <Button variant="primary" onClick={loadFromFolder}>
                        Choose Team Trials Folder
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="page-shell">
            <Row className="replay-layout">
                <Col md={3}>
                    <div className="replay-sidebar-card p-3">
                        <SectionHeading title="Trials Database" compact className="mt-0" />
                        <Form.Control
                            type="search"
                            placeholder="Search Saved Trials"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="mb-3"
                        />
                        <ListGroup variant="flush" className="replay-trial-list" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                            {filteredIndex.map((entry) => {
                                const won = isSessionVictory(entry.roundsWon, entry.roundCount);
                                return (
                                    <ListGroup.Item
                                        key={entry.id}
                                        action
                                        active={entry.id === selectedSessionId}
                                        onClick={() => { setSelectedSessionId(entry.id); setSelectedRound(0); }}
                                        className={`replay-trial-item ${won ? 'replay-trial-item--win' : 'replay-trial-item--loss'}`}
                                    >
                                        <div className="small replay-trial-item-title">
                                            {formatTrialLabel(entry, opponentTrainerBySessionId.get(entry.id) ?? entry.opponentTrainerName ?? '')}
                                        </div>
                                        <div className={`small replay-trial-item-outcome ${won ? 'replay-trial-item-outcome--win' : 'replay-trial-item-outcome--loss'}`}>
                                            {formatSessionOutcome(entry)}
                                        </div>
                                    </ListGroup.Item>
                                );
                            })}
                        </ListGroup>
                    </div>
                </Col>
                <Col md={9}>
                    {!session && (
                        <div className="replay-stage-card empty-state">Select a Trial to view its replay.</div>
                    )}
                    {session && round && (
                        <div className="replay-stage-card p-3">
                            <div className="replay-header-panel d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                                <div>
                                    <h5 className="mb-0">{session.fileName}</h5>
                                    <div className="text-muted small">
                                        {formatReplayRoundDescription(round)}
                                    </div>
                                </div>
                                <ButtonGroup>
                                    {session.rounds.map((r, i) => (
                                        <Button
                                            key={r.round}
                                            variant={i === selectedRound ? 'primary' : 'outline-secondary'}
                                            size="sm"
                                            onClick={() => setSelectedRound(i)}
                                        >
                                            R{r.round}: {DISTANCE_LABELS[r.distanceType] ?? 'Unknown'}
                                        </Button>
                                    ))}
                                </ButtonGroup>
                            </div>
                            <RaceDataPresenter
                                key={`${session.id}-${selectedRound}`}
                                raceHorseInfo={round.parsedRace.raceHorseInfo}
                                raceData={round.parsedRace.raceData}
                                detectedCourseId={round.parsedRace.detectedCourseId}
                                raceType={round.parsedRace.raceType}
                                trackDetails={round.parsedRace.trackDetails}
                            />
                        </div>
                    )}
                    {session && !round && <Spinner animation="border" size="sm" />}
                </Col>
            </Row>
        </div>
    );
}
