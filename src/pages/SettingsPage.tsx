import { useEffect, useState } from 'react';

import { Alert, Button, Container, Form } from 'react-bootstrap';

import { fetchServerConfig, updateServerConfig } from '../data/raceLoader';

import { useRaceStore } from '../store/RaceStore';
import SectionHeading from '../components/SectionHeading';



export default function SettingsPage() {

    const { dataSource, trainerName: activeTrainer, loadFromServer, loadFromFolder, reload, loading, progress } = useRaceStore();

    const [dataPath, setDataPath] = useState('');

    const [trainerName, setTrainerName] = useState('');

    const [message, setMessage] = useState('');

    const [error, setError] = useState('');



    useEffect(() => {

        fetchServerConfig()

            .then((cfg) => {

                setDataPath(cfg.dataPath);

                setTrainerName(cfg.trainerName);

            })

            .catch(() => setDataPath(''));

    }, []);



    async function saveSettings() {

        setError('');

        setMessage('');

        try {

            await updateServerConfig({ dataPath, trainerName });

            setMessage('Settings updated. Reloading sessions...');

            await loadFromServer();

        } catch (err: any) {

            setError(err.message ?? String(err));

        }

    }



    return (

        <Container fluid className="pb-5 pt-3 page-shell">

        <div className="settings-card">

            <SectionHeading level="section" title="Settings: Data Source" className="mt-0" />

            <p className="text-muted">

                Default mode uses the local API server to read JSON files from a folder on disk.

                Folder picker mode reads files directly in the browser (Chrome/Edge).

            </p>



            {message && <Alert variant="success">{message}</Alert>}

            {error && <Alert variant="danger">{error}</Alert>}



            <Form.Group className="mb-3">

                <Form.Label>Server data path (Team Trials JSON folder)</Form.Label>

                <Form.Control

                    type="text"

                    value={dataPath}

                    onChange={(e) => setDataPath(e.target.value)}

                />

            </Form.Group>

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

                <Button variant="primary" onClick={saveSettings} disabled={loading}>Save & Load</Button>

                <Button variant="outline-secondary" onClick={loadFromServer} disabled={loading}>Load from Server</Button>

                <Button variant="outline-secondary" onClick={loadFromFolder} disabled={loading}>Load from Folder</Button>

                <Button variant="outline-secondary" onClick={reload} disabled={loading || !dataSource}>Reload</Button>

            </div>



            {loading && (

                <Alert variant="info">

                    Loading {progress.loaded}/{progress.total} sessions...

                </Alert>

            )}



            <Alert variant="secondary" className="mb-0">

                <strong>Current source:</strong> {dataSource ?? 'none'}

                <br />

                <strong>Detected player:</strong> {activeTrainer || 'pending load'}

            </Alert>

        </div>

        </Container>

    );

}

