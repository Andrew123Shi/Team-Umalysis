import { useEffect, useState } from 'react';

import { Alert, Button, ButtonGroup, Form } from 'react-bootstrap';

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
        <div className="page-shell">
            <section className="analytics-section">
                <SectionHeading level="section" title="Settings" />
                <div className="layout-grid is-2 settings-layout">
                    <section className="app-card settings-card">
                        <SectionHeading title="Data Source" />

                        <p className="settings-copy">
                            Team Umalysis reads Team Trials JSON files directly in your browser.
                            Choose the folder where horseACT saves your <code>TT-*.json</code> files.
                        </p>

                        {message && <Alert variant="success">{message}</Alert>}

                        <div className="settings-actions">
                            <Button variant="primary" onClick={loadFromFolder} disabled={loading}>
                                Choose/Change Team Trials Folder
                            </Button>
                            <Button variant="outline-secondary" onClick={reload} disabled={loading}>
                                Reload Folder
                            </Button>
                            {loading && (
                                <span className="settings-progress">
                                    {progress.total > 0 ? `Loading ${progress.loaded}/${progress.total} files…` : 'Initializing file loading…'}
                                </span>
                            )}
                        </div>

                        <dl className="settings-facts">
                            <div>
                                <dt>Last loaded</dt>
                                <dd>{lastLoadedText}</dd>
                            </div>
                            <div>
                                <dt>Loaded files</dt>
                                <dd>{loading && progress.total > 0 ? progress.loaded : index.length}</dd>
                            </div>
                            <div>
                                <dt>Detected player</dt>
                                <dd>{activeTrainer || 'pending load'}</dd>
                            </div>
                        </dl>

                        <Form.Group className="settings-field">
                            <Form.Label htmlFor="trainer-override">Player trainer override (optional)</Form.Label>
                            <div className="settings-inline">
                                <Form.Control
                                    id="trainer-override"
                                    type="text"
                                    value={trainerName}
                                    onChange={(e) => setTrainerName(e.target.value)}
                                    placeholder="Auto-detected"
                                />
                                <Button variant="primary" onClick={saveSettings} disabled={loading}>
                                    Save
                                </Button>
                            </div>
                            <Form.Text>
                                Normally auto-detected as the trainer name that appears across every session on the same team.
                                Override only if detection picks the wrong player.
                            </Form.Text>
                        </Form.Group>
                    </section>

                    <section className="app-card settings-card">
                        <SectionHeading
                            title="Score Bonuses"
                            actions={(
                                <ButtonGroup size="sm">
                                    <Button
                                        variant={isBaseOnly ? 'secondary' : 'outline-secondary'}
                                        onClick={() => setAllScoreBonuses(BASE_SCORE_ONLY)}
                                    >
                                        Base Only
                                    </Button>
                                    <Button
                                        variant={isInGame ? 'secondary' : 'outline-secondary'}
                                        onClick={() => setAllScoreBonuses(IN_GAME_SCORE)}
                                    >
                                        Match In-Game
                                    </Button>
                                </ButtonGroup>
                            )}
                        />

                        <p className="settings-copy">
                            Team Trials scores are a base value plus up to four bonuses. Choose which bonuses count in score analytics:
                        </p>

                        <div className="settings-toggles">
                            {SCORE_BONUS_KEYS.map((key) => (
                                <Form.Check
                                    key={key}
                                    type="switch"
                                    id={`score-bonus-${key}`}
                                    checked={scoreBonuses[key]}
                                    onChange={(e) => setScoreBonusEnabled(key, e.target.checked)}
                                    label={SCORE_BONUS_LABELS[key]}
                                    className="settings-toggle"
                                />
                            ))}
                        </div>

                        <div className="settings-notes">
                            <div className="panel-label">How scores are totaled</div>
                            <ul>
                                <li>Uma scores count only that uma&apos;s own score lines.</li>
                                <li>Race scores count all three umas plus the placement team bonuses (e.g. All Members Placed).</li>
                                <li>Session totals count all five races plus the victory bonus.</li>
                                <li>The replay list always shows in-game scores.</li>
                            </ul>
                        </div>
                    </section>
                </div>
            </section>
        </div>
    );
}

