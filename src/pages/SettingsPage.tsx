import { useEffect, useState } from 'react';

import { Alert, Button, Container, Form } from 'react-bootstrap';

import SectionHeading from '../components/SectionHeading';
import { useRaceStore } from '../store/RaceStore';

export default function SettingsPage() {
    const {
        lastLoadedAt,
        latestFileName,
        trainerName: activeTrainer,
        trainerNameOverride,
        debugMode,
        scoreBonuses,
        index,
        loadFromFolder,
        reload,
        saveTrainerNameOverride,
        setDebugMode,
        setScoreBonusEnabled,
        loading,
        progress,
    } = useRaceStore();

    const [trainerName, setTrainerName] = useState(trainerNameOverride);
    const [message, setMessage] = useState('');
    const formatLoadDate = (date: Date) => {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${month}/${day}/${date.getFullYear()}`;
    };
    const lastLoadedText = lastLoadedAt && latestFileName
        ? `${formatLoadDate(lastLoadedAt)} "${latestFileName}"`
        : 'never';

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
            <SectionHeading level="section" title="Settings" className="mt-0" />

            <div className="settings-card">
                <Form.Group className="mb-4">
                    <Form.Label className="fw-bold">Data Source</Form.Label>
                    <div className="d-flex align-items-center gap-2 mb-2">
                        <Button variant="primary" onClick={loadFromFolder} disabled={loading}>
                            Choose/Change Team Trials Folder
                        </Button>
                        <Button variant="outline-secondary" onClick={reload} disabled={loading}>
                            Reload Folder
                        </Button>
                        {loading && (
                            <span className="text-muted">
                                {progress.total > 0 ? `Loading ${progress.loaded}/${progress.total} files...` : 'Loading files...'}
                            </span>
                        )}
                    </div>
                    <Form.Text className="text-muted">
                        Team Umalysis reads Team Trials JSON files directly in your browser.
                        Choose the folder where horseACT saves your <code>TT-*.json</code> files.
                    </Form.Text>
                </Form.Group>

                {message && <Alert variant="success">{message}</Alert>}
                <Form.Group className="mb-3">
                    <Form.Label className="fw-bold">Player Trainer Name Override</Form.Label>
                    <Form.Control
                        type="text"
                        value={trainerName}
                        onChange={(e) => setTrainerName(e.target.value)}
                        placeholder="Auto-detected"
                    />
                </Form.Group>

                <div className="d-flex gap-2 mb-2">
                    <Button variant="primary" onClick={saveSettings} disabled={loading}>
                        Save Trainer Override
                    </Button>
                </div>
                <Form.Text className="d-block text-muted mb-4">
                    Normally auto-detected as the trainer name that appears across every session on the same team.
                    Override only if detection picks the wrong player.
                </Form.Text>

                <Alert variant="secondary" className="mb-0">
                    <strong>Last loaded:</strong> {lastLoadedText}
                    <br />
                    <strong>Loaded files:</strong> {loading && progress.total > 0 ? progress.loaded : index.length}
                    <br />
                    <strong>Detected player:</strong> {activeTrainer || 'pending load'}
                </Alert>
            </div>

            <div className="settings-card mt-3">
                <Form.Group className="mb-4">
                    <Form.Label className="fw-bold">Score Bonus Handling</Form.Label>
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
                    />
                    <Form.Check
                        type="checkbox"
                        id="score-bonus-support-card"
                        checked={scoreBonuses.supportCard}
                        onChange={(e) => setScoreBonusEnabled('supportCard', e.target.checked)}
                        label="Support Card Bonus"
                    />
                    <Form.Text className="text-muted">
                        By default, uma-level analytics use base score only with no bonuses reflected and distance-level analytics use base score with only the All Members Placed bonus.
                        In general, a "raw" score is the score shown in-game with all the bonuses selected.
                        <br />
                        Note the setting does not affect overall roster analytics, which will continue to show all bonuses except for Support Card Bonus (except when stated otherwise). 
                    </Form.Text>
                </Form.Group>

                <Form.Group className="mb-0">
                    <Form.Label className="fw-bold">Debug Mode</Form.Label>
                    <Form.Check
                        type="checkbox"
                        id="debug-mode"
                        checked={debugMode}
                        onChange={(e) => setDebugMode(e.target.checked)}
                        label="Debug Mode"
                    />
                </Form.Group>
            </div>
        </Container>
    );
}

