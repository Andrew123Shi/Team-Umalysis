import { useMemo, useState } from 'react';
import { Alert, Button, ButtonGroup, Form, Spinner } from 'react-bootstrap';
import RaceDataPresenter from '../components/RaceDataPresenter';
import { deserializeFromBase64 } from '../data/RaceDataParser';
import PriorityFilesLoadingAlert from '../components/PriorityFilesLoadingAlert';
import RemainingFilesLoadingAlert from '../components/RemainingFilesLoadingAlert';
import { DISTANCE_LABELS, type SessionIndexEntry, type TTRound } from '../analytics/types';
import { getCourseDisplayName } from '../utils/course';
import { formatScore } from '../utils/formatScore';
import { getSessionOpponentTrainer } from '../analytics/umaIdentity';
import { useRaceStore } from '../store/RaceStore';
import SectionHeading from '../components/SectionHeading';
import { inGameRoundScore } from '../utils/teamTrialScore';

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

function formatReplayRoundDescription(round: TTRound): string {
    const courseId = round.courseId ?? round.parsedRace.detectedCourseId;
    const sprint = DISTANCE_LABELS[round.distanceType] ?? round.distanceLabel ?? 'Unknown';
    const course = getCourseDisplayName(courseId) ?? 'Unknown';
    return `${sprint} · ${course} · Score ${formatScore(inGameRoundScore(round))} · Opp. Rating ${round.opponentEvaluate.toLocaleString()}`;
}

export default function ReplayPage() {
    const { sessions, index, loading, error, hasTriedSavedFolder, loadFromFolder } = useRaceStore();
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
    const raceData = useMemo(
        () => (round ? deserializeFromBase64(round.parsedRace.raceScenario) : null),
        [round],
    );

    if (loading && !sessions.length) {
        return (
            <div className="page-shell">
                <PriorityFilesLoadingAlert />
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
            <RemainingFilesLoadingAlert />
            <div className="replay-layout">
                <aside className="app-card replay-sidebar-card">
                    <SectionHeading
                        title="Trials"
                        actions={<span className="replay-trial-count">{filteredIndex.length}</span>}
                    />
                    <Form.Control
                        type="search"
                        size="sm"
                        placeholder="Search date, opponent, file…"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="replay-search"
                    />
                    <div className="replay-trial-list" role="listbox" aria-label="Saved trials">
                        {filteredIndex.map((entry) => {
                            const won = isSessionVictory(entry.roundsWon, entry.roundCount);
                            const active = entry.id === selectedSessionId;
                            return (
                                <button
                                    key={entry.id}
                                    type="button"
                                    role="option"
                                    aria-selected={active}
                                    onClick={() => { setSelectedSessionId(entry.id); setSelectedRound(0); }}
                                    className={`replay-trial-item ${won ? 'replay-trial-item--win' : 'replay-trial-item--loss'}${active ? ' active' : ''}`}
                                >
                                    <span className="replay-trial-item-title">
                                        {formatTrialLabel(entry, opponentTrainerBySessionId.get(entry.id) ?? entry.opponentTrainerName ?? '')}
                                    </span>
                                    <span className="replay-trial-item-meta">
                                        <span className="replay-trial-pips" aria-label={`${entry.roundsWon} of ${entry.roundCount} races won`}>
                                            {Array.from({ length: entry.roundCount }, (_, i) => (
                                                <i key={i} className={i < entry.roundsWon ? 'is-won' : undefined} />
                                            ))}
                                        </span>
                                        <span className={`replay-trial-item-outcome ${won ? 'replay-trial-item-outcome--win' : 'replay-trial-item-outcome--loss'}`}>
                                            {won ? 'W' : 'L'} {entry.roundsWon}/{entry.roundCount}
                                        </span>
                                        <span className="replay-trial-item-score">{formatScore(entry.totalTeamScore)}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </aside>
                <div className="replay-stage">
                    {!session && (
                        <div className="app-card replay-stage-card empty-state">Select a trial to view its replay.</div>
                    )}
                    {session && round && raceData && (
                        <div className="app-card replay-stage-card">
                            <div className="replay-header-panel">
                                <div className="replay-header-text">
                                    <h2 className="replay-header-title">{session.fileName}</h2>
                                    <div className="replay-header-sub">{formatReplayRoundDescription(round)}</div>
                                </div>
                                <ButtonGroup size="sm" className="replay-round-picker">
                                    {session.rounds.map((r, i) => (
                                        <Button
                                            key={r.round}
                                            variant={i === selectedRound ? 'primary' : 'outline-secondary'}
                                            onClick={() => setSelectedRound(i)}
                                            className={r.playerWonRound ? 'is-won' : 'is-lost'}
                                        >
                                            <span className="replay-round-index">R{r.round}</span>
                                            {DISTANCE_LABELS[r.distanceType] ?? 'Unknown'}
                                        </Button>
                                    ))}
                                </ButtonGroup>
                            </div>
                            <RaceDataPresenter
                                key={`${session.id}-${selectedRound}`}
                                raceHorseInfo={round.parsedRace.raceHorseInfo}
                                raceData={raceData}
                                detectedCourseId={round.parsedRace.detectedCourseId}
                                raceType={round.parsedRace.raceType}
                                trackDetails={round.parsedRace.trackDetails}
                            />
                        </div>
                    )}
                    {session && !round && <Spinner animation="border" size="sm" />}
                </div>
            </div>
        </div>
    );
}
