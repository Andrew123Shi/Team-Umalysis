import { useEffect, useState } from 'react';

import { Alert, Button, Container, Form } from 'react-bootstrap';

import SectionHeading from '../components/SectionHeading';
import { useRaceProgress, useRaceStore } from '../store/RaceStore';

export default function SettingsPage() {
    const {
        lastLoadedAt,
        latestFileName,
        trainerName: activeTrainer,
        trainerNameOverride,
        scoreBonuses,
        index,
        loadFromFolder,
        reload,
        saveTrainerNameOverride,
        setScoreBonusEnabled,
        loading,
    } = useRaceStore();
    const { progress } = useRaceProgress();

    const [trainerName, setTrainerName] = useState(trainerNameOverride);
    const [message, setMessage] = useState('');
    const formatLoadDate = (date: Date) => {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${month}/${day}/${date.getFullYear()}`;
    };
    const lastLoadedText = lastLoadedAt && latestFileName
        ? `${formatLoadDate(lastLoadedAt)} "${latestFileName}"`
        : 'Never';

    useEffect(() => {
        setTrainerName(trainerNameOverride);
    }, [trainerNameOverride]);

    function saveSettings() {
        setMessage('');
        saveTrainerNameOverride(trainerName);
        setMessage('Trainer override saved.');
    }

    return (
        <Container fluid className="pb-5 pt-3 page-shell">
            <div className="settings-card">
                <SectionHeading level="section" title="Settings: Data Source" className="mt-0" />

                <p className="text-muted">
                    Team Umalysis reads Team Trials JSON files directly in your browser.
                    Choose the folder where horseACT saves your <code>TT-*.json</code> files.
                </p>

                {message && <Alert variant="success">{message}</Alert>}

                <div className="d-flex align-items-center gap-2 mb-4">
                    <Button variant="primary" onClick={loadFromFolder} disabled={loading}>
                        Choose/Change Team Trials Folder
                    </Button>
                    <Button variant="outline-secondary" onClick={reload} disabled={loading}>
                        Reload Folder
                    </Button>
                    {loading && (
                        <span className="text-muted">
                            {progress.total > 0 ? `Loading ${progress.loaded}/${progress.total} files...` : 'Initializing file loading...'}
                        </span>
                    )}
                </div>

                <Form.Group className="mb-3">
                    <Form.Label>Player trainer override (optional)</Form.Label>
                    <Form.Control
                        type="text"
                        value={trainerName}
                        onChange={(e) => setTrainerName(e.target.value)}
                        placeholder="Auto-detected"
                    />
                    <Form.Text className="text-muted">
                        Normally auto-detected as the trainer name that appears across every session on the same team.
                        Override only if detection picks the wrong player.
                    </Form.Text>
                </Form.Group>

                <div className="d-flex gap-2 mb-4">
                    <Button variant="primary" onClick={saveSettings} disabled={loading}>
                        Save Trainer Override
                    </Button>
                </div>

                <Alert variant="secondary" className="mb-0">
                    <strong>Last loaded:</strong> {lastLoadedText}
                    <br />
                    <strong>Loaded files:</strong> {loading && progress.total > 0 ? progress.loaded : index.length}
                    <br />
                    <strong>Detected player:</strong> {activeTrainer || 'pending load'}
                </Alert>
            </div>

            <div className="settings-card mt-3">
                <SectionHeading level="section" title="Settings: Score Bonuses" className="mt-0" />

                <p className="text-muted mb-2">
                    Choose which bonuses are included in score analytics.
                    Changes apply immediately and are saved in this browser.
                </p>

                <Form.Check
                    type="checkbox"
                    id="score-bonus-support-card"
                    checked={scoreBonuses.supportCard}
                    onChange={(e) => setScoreBonusEnabled('supportCard', e.target.checked)}
                    label="Support Card Bonus"
                    className="mb-0"
                />

                <Form.Text className="d-block text-muted fst-italic my-1">
                    Applies to Uma and Distance Analysis only:
                </Form.Text>
                <Form.Check
                    type="checkbox"
                    id="score-bonus-ace"
                    checked={scoreBonuses.ace}
                    onChange={(e) => setScoreBonusEnabled('ace', e.target.checked)}
                    label="Ace Bonus"
                />
                <Form.Check
                    type="checkbox"
                    id="score-bonus-opponent-rating"
                    checked={scoreBonuses.opponentRating}
                    onChange={(e) => setScoreBonusEnabled('opponentRating', e.target.checked)}
                    label="Opponent Rating Bonus"
                />
                <Form.Check
                    type="checkbox"
                    id="score-bonus-streak"
                    checked={scoreBonuses.streak}
                    onChange={(e) => setScoreBonusEnabled('streak', e.target.checked)}
                    label="Streak Bonus"
                    className="mb-2"
                />

                <Form.Text className="d-block text-muted mt-0">
                    With all options off, Distance Analysis includes the All Members Placed bonus
                    while Uma Analysis uses base score only.
                </Form.Text>
            </div>
        </Container>
    );
}

