import { useEffect, useState } from 'react';

import { Alert, Button, ButtonGroup, Container, Form } from 'react-bootstrap';

import type { ScoreBonusKey } from '../analytics/types';
import SectionHeading from '../components/SectionHeading';
import { useRaceProgress, useRaceStore } from '../store/RaceStore';
import { BASE_SCORE_ONLY, IN_GAME_SCORE, SCORE_BONUS_KEYS } from '../utils/teamTrialScore';

const SCORE_BONUS_LABELS: Record<ScoreBonusKey, string> = {
    supportCard: 'Support Card Bonus',
    opponentRating: 'Opponent Rating Bonus',
    streak: 'Win Streak Bonus',
    ace: 'Ace Bonus',
};
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
        setAllScoreBonuses,
        loading,
    } = useRaceStore();
    const { progress } = useRaceProgress();
    const isBaseOnly = SCORE_BONUS_KEYS.every((key) => !scoreBonuses[key]);
    const isInGame = SCORE_BONUS_KEYS.every((key) => scoreBonuses[key]);

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
                    Team Trials scores are calculated as a base value plus up to four bonuses. Choose which bonuses count in score analytics:
                </p>

                <ButtonGroup size="sm" className="mb-3">
                    <Button
                        variant={isBaseOnly ? 'secondary' : 'outline-secondary'}
                        onClick={() => setAllScoreBonuses(BASE_SCORE_ONLY)}
                    >
                        Base Score Only
                    </Button>
                    <Button
                        variant={isInGame ? 'secondary' : 'outline-secondary'}
                        onClick={() => setAllScoreBonuses(IN_GAME_SCORE)}
                    >
                        Match In-Game Score
                    </Button>
                </ButtonGroup>

                {SCORE_BONUS_KEYS.map((key) => (
                    <Form.Check
                        key={key}
                        type="checkbox"
                        id={`score-bonus-${key}`}
                        checked={scoreBonuses[key]}
                        onChange={(e) => setScoreBonusEnabled(key, e.target.checked)}
                        label={SCORE_BONUS_LABELS[key]}
                    />
                ))}

                <Form.Text as="div" className="text-muted mt-3">
                    <strong>How scores are totaled:</strong>
                    <ul className="mb-0 ps-3">
                        <li>Uma scores count only that uma&apos;s own score lines.</li>
                        <li>
                            Race scores count all three umas plus the placement team bonuses (e.g. All Members Placed)
                        </li>
                        <li>
                            Session totals count all five races plus the victory bonus.
                        </li>
                        <li>
                            The replay list always shows in-game scores.
                        </li>
                    </ul>
                </Form.Text>
            </div>
        </Container>
    );
}

