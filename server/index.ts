import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'config.json');
const PORT = 3001;

type ServerConfig = { dataPath: string; trainerName: string };

function readConfig(): ServerConfig {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ServerConfig>;
    return {
        dataPath: parsed.dataPath ?? '',
        trainerName: parsed.trainerName ?? '',
    };
}

function writeConfig(config: ServerConfig) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function parseSessionFilename(fileName: string): Date | null {
    const match = fileName.match(/^TT-(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_(\d+)\.json$/i);
    if (!match) return null;
    const [, y, mo, d, h, mi, s, ms] = match;
    return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s), Number(ms));
}

function detectPlayerIdentityFromSession(starts: any[]): { teamId: number; trainerName: string } {
    const counts = new Map<string, number>();
    for (const start of starts) {
        const horses = Array.isArray(start?.race_horse_data_array) ? start.race_horse_data_array : [];
        for (const horse of horses) {
            const teamId = Number(horse?.team_id);
            const trainer = String(horse?.trainer_name ?? '');
            if (teamId > 0 && trainer) {
                const key = `${teamId}:${trainer}`;
                counts.set(key, (counts.get(key) ?? 0) + 1);
            }
        }
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const max = sorted[0]?.[1] ?? 0;
    const tied = sorted.filter(([, count]) => count === max);
    const bonos = tied.find(([key]) => key === '1:BonosDischarge');
    if (bonos) return { teamId: 1, trainerName: 'BonosDischarge' };
    const [key] = tied.sort(([a], [b]) => Number(a.split(':')[0]) - Number(b.split(':')[0]));
    const [teamId, trainerName] = (key ?? '1:').split(':');
    return { teamId: Number(teamId), trainerName };
}

function indexSession(filePath: string, fileName: string) {
    const id = fileName.replace(/\.json$/i, '');
    const savedAt = parseSessionFilename(fileName);
    let playerTeamId = 1;
    let playerTrainerName = '';
    let supportCardBonus = 0;
    let totalTeamScore = 0;
    let roundsWon = 0;
    let opponentEvaluate = 0;

    try {
        const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        supportCardBonus = Number(json.support_card_bonus) || 0;
        const results = Array.isArray(json.race_result_array) ? json.race_result_array : [];
        const starts = Array.isArray(json.race_start_params_array) ? json.race_start_params_array : [];
        const identity = detectPlayerIdentityFromSession(starts);
        playerTeamId = identity.teamId;
        playerTrainerName = identity.trainerName;
        const opponentTeamId = playerTeamId === 1 ? 2 : 1;
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            totalTeamScore += Number(result.team_total_score) || 0;
            const charaResults = Array.isArray(result.chara_result_array) ? result.chara_result_array : [];
            const playerBest = charaResults
                .filter((c: any) => Number(c.team_id) === playerTeamId)
                .reduce((best: number, c: any) => Math.min(best, Number(c.finish_order) || 99), 99);
            const opponentBest = charaResults
                .filter((c: any) => Number(c.team_id) === opponentTeamId)
                .reduce((best: number, c: any) => Math.min(best, Number(c.finish_order) || 99), 99);
            if (playerBest < opponentBest) roundsWon += 1;
            const start = starts[i];
            if (start?.opponent_evaluate) opponentEvaluate = Number(start.opponent_evaluate);
        }
    } catch {
        // keep defaults
    }

    return {
        id,
        fileName,
        savedAt: savedAt?.toISOString() ?? null,
        playerTeamId,
        playerTrainerName,
        supportCardBonus,
        totalTeamScore,
        roundsWon,
        roundCount: 5,
        opponentEvaluate,
    };
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
});

app.get('/api/config', (_req, res) => {
    res.json(readConfig());
});

app.put('/api/config', (req, res) => {
    const current = readConfig();
    const dataPath = String(req.body?.dataPath ?? current.dataPath).trim();
    const trainerName = String(req.body?.trainerName ?? current.trainerName).trim();
    if (!dataPath) {
        res.status(400).json({ error: 'dataPath is required' });
        return;
    }
    if (!fs.existsSync(dataPath)) {
        res.status(400).json({ error: `Path does not exist: ${dataPath}` });
        return;
    }
    writeConfig({ dataPath, trainerName });
    res.json({ dataPath, trainerName });
});

app.get('/api/sessions', (_req, res) => {
    const { dataPath } = readConfig();
    if (!fs.existsSync(dataPath)) {
        res.status(404).json({ error: `Data path not found: ${dataPath}` });
        return;
    }
    const files = fs.readdirSync(dataPath)
        .filter((f) => /^TT-.*\.json$/i.test(f))
        .sort((a, b) => b.localeCompare(a));
    const { trainerName } = readConfig();
    const sessions = files.map((fileName) => indexSession(path.join(dataPath, fileName), fileName));
    res.json({ dataPath, trainerName, sessions });
});

app.get('/api/sessions/:id', (req, res) => {
    const { dataPath } = readConfig();
    const fileName = `${req.params.id}.json`;
    const filePath = path.join(dataPath, fileName);
    if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'Session not found' });
        return;
    }
    const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    res.json({ id: req.params.id, fileName, json });
});

app.listen(PORT, '127.0.0.1', () => {
    const { dataPath } = readConfig();
    console.log(`Team Umalysis API listening on http://127.0.0.1:${PORT}`);
    console.log(`Data path: ${dataPath}`);
});
