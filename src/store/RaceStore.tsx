import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { ScoreBonusKey, ScoreBonusSettings, SessionIndexEntry, TTSession } from '../analytics/types';

import { getSessionOpponentTrainer, resolvePlayerIdentity } from '../analytics/umaIdentity';
import {
    loadSessionsFromSavedFolder,
    pickFolderAndLoadSessions,
    type DataSource,
} from '../data/raceLoader';
import { rawSessionTeamScore } from '../utils/teamTrialScore';

const TRAINER_OVERRIDE_KEY = 'team-umalysis-trainer-name-override';
const DEBUG_MODE_KEY = 'team-umalysis-debug-mode';
const SCORE_BONUSES_KEY = 'team-umalysis-score-bonuses';
const DEFAULT_SCORE_BONUSES: ScoreBonusSettings = {
    ace: false,
    opponentRating: false,
    streak: false,
    supportCard: false,
};

type RaceStoreValue = {
    sessions: TTSession[];
    index: SessionIndexEntry[];
    trainerName: string;
    trainerNameOverride: string;
    debugMode: boolean;
    scoreBonuses: ScoreBonusSettings;
    dataSource: DataSource | null;
    folderName: string;
    lastLoadedAt: Date | null;
    latestFileName: string;
    loading: boolean;
    hasTriedSavedFolder: boolean;
    progress: { loaded: number; total: number };
    error: string;
    loadFromFolder: () => Promise<void>;
    reload: () => Promise<void>;
    saveTrainerNameOverride: (value: string) => void;
    setDebugMode: (enabled: boolean) => void;
    setScoreBonusEnabled: (bonus: ScoreBonusKey, enabled: boolean) => void;
};

const RaceStoreContext = createContext<RaceStoreValue | null>(null);

/** Survives StrictMode remount so auto-load only runs once per page load. */
let autoLoadStarted = false;

function loadStoredTrainerNameOverride() {
    try {
        return localStorage.getItem(TRAINER_OVERRIDE_KEY) ?? '';
    } catch {
        return '';
    }
}

function saveStoredTrainerNameOverride(value: string) {
    try {
        const trimmed = value.trim();
        if (trimmed) localStorage.setItem(TRAINER_OVERRIDE_KEY, trimmed);
        else localStorage.removeItem(TRAINER_OVERRIDE_KEY);
    } catch {
        // Ignore storage failures; the override still applies for this session.
    }
}

function loadStoredDebugMode(): boolean {
    try {
        return localStorage.getItem(DEBUG_MODE_KEY) === '1';
    } catch {
        return false;
    }
}

function saveStoredDebugMode(enabled: boolean) {
    try {
        if (enabled) localStorage.setItem(DEBUG_MODE_KEY, '1');
        else localStorage.removeItem(DEBUG_MODE_KEY);
    } catch {
        // Ignore storage failures; the setting still applies for this session.
    }
}

function loadStoredScoreBonuses(): ScoreBonusSettings {
    try {
        const parsed = JSON.parse(localStorage.getItem(SCORE_BONUSES_KEY) ?? '{}') as Partial<ScoreBonusSettings>;
        return {
            ace: parsed.ace === true,
            opponentRating: parsed.opponentRating === true,
            streak: parsed.streak === true,
            supportCard: parsed.supportCard === true,
        };
    } catch {
        return DEFAULT_SCORE_BONUSES;
    }
}

function saveStoredScoreBonuses(scoreBonuses: ScoreBonusSettings) {
    try {
        localStorage.setItem(SCORE_BONUSES_KEY, JSON.stringify(scoreBonuses));
    } catch {
        // Ignore storage failures; the setting still applies for this session.
    }
}

function isAbortError(err: unknown) {
    return err instanceof DOMException && err.name === 'AbortError';
}

function buildIndexEntry(session: TTSession): SessionIndexEntry {
    return {
        id: session.id,
        fileName: session.fileName,
        savedAt: session.savedAt?.toISOString() ?? null,
        playerTrainerName: session.playerTrainerName,
        opponentTrainerName: getSessionOpponentTrainer(session),
        supportCardBonus: session.supportCardBonus,
        totalTeamScore: rawSessionTeamScore(session.rounds),
        roundsWon: session.rounds.filter((r) => r.playerWonRound).length,
        roundCount: session.rounds.length,
        opponentEvaluate: session.rounds[0]?.opponentEvaluate ?? 0,
    };
}

export function RaceStoreProvider({ children }: { children: React.ReactNode }) {
    const [sessions, setSessions] = useState<TTSession[]>([]);
    const [index, setIndex] = useState<SessionIndexEntry[]>([]);
    const [trainerName, setTrainerName] = useState('');
    const [trainerNameOverride, setTrainerNameOverride] = useState(loadStoredTrainerNameOverride);
    const [debugMode, setDebugModeState] = useState(loadStoredDebugMode);
    const [scoreBonuses, setScoreBonuses] = useState<ScoreBonusSettings>(loadStoredScoreBonuses);
    const [dataSource, setDataSource] = useState<DataSource | null>(null);
    const [folderName, setFolderName] = useState('');
    const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
    const [latestFileName, setLatestFileName] = useState('');
    const [loading, setLoading] = useState(false);
    const [hasTriedSavedFolder, setHasTriedSavedFolder] = useState(false);
    const [progress, setProgress] = useState({ loaded: 0, total: 0 });
    const [error, setError] = useState('');

    const onProgress = useCallback((loaded: number, total: number) => {
        setProgress({ loaded, total });
    }, []);

    const finalizeSessions = useCallback((parsed: TTSession[], configuredTrainer: string) => {
        const identity = resolvePlayerIdentity(parsed, configuredTrainer);
        setTrainerName(identity.trainerName);
        setSessions(parsed);
        setIndex(parsed.map(buildIndexEntry));
    }, []);

    const loadFromSavedFolder = useCallback(async () => {
        setLoading(true);
        setError('');
        setProgress({ loaded: 0, total: 0 });
        try {
            const result = await loadSessionsFromSavedFolder(onProgress);
            if (!result) {
                setDataSource(null);
                return;
            }
            finalizeSessions(result.sessions, trainerNameOverride);
            setFolderName(result.folderName);
            setLastLoadedAt(new Date());
            setLatestFileName(result.latestFileName);
            setDataSource('folder');
        } catch (err: any) {
            setError(err.message ?? String(err));
        } finally {
            setHasTriedSavedFolder(true);
            setLoading(false);
        }
    }, [onProgress, finalizeSessions, trainerNameOverride]);

    const loadFromFolder = useCallback(async () => {
        setError('');
        setProgress({ loaded: 0, total: 0 });
        try {
            const result = await pickFolderAndLoadSessions(onProgress, () => setLoading(true));
            finalizeSessions(result.sessions, trainerNameOverride);
            setFolderName(result.folderName);
            setLastLoadedAt(new Date());
            setLatestFileName(result.latestFileName);
            setDataSource('folder');
            setHasTriedSavedFolder(true);
        } catch (err: any) {
            if (!isAbortError(err)) setError(err.message ?? String(err));
        } finally {
            setLoading(false);
        }
    }, [onProgress, finalizeSessions, trainerNameOverride]);

    const reload = useCallback(async () => {
        setLoading(true);
        setError('');
        setProgress({ loaded: 0, total: 0 });
        try {
            let result = await loadSessionsFromSavedFolder(onProgress);
            if (!result) result = await pickFolderAndLoadSessions(onProgress);
            finalizeSessions(result.sessions, trainerNameOverride);
            setFolderName(result.folderName);
            setLastLoadedAt(new Date());
            setLatestFileName(result.latestFileName);
            setDataSource('folder');
            setHasTriedSavedFolder(true);
        } catch (err: any) {
            if (!isAbortError(err)) setError(err.message ?? String(err));
        } finally {
            setLoading(false);
        }
    }, [onProgress, finalizeSessions, trainerNameOverride]);

    const saveTrainerNameOverride = useCallback((value: string) => {
        const trimmed = value.trim();
        saveStoredTrainerNameOverride(trimmed);
        setTrainerNameOverride(trimmed);
        finalizeSessions(sessions, trimmed);
    }, [finalizeSessions, sessions]);

    const setDebugMode = useCallback((enabled: boolean) => {
        saveStoredDebugMode(enabled);
        setDebugModeState(enabled);
    }, []);

    const setScoreBonusEnabled = useCallback((bonus: ScoreBonusKey, enabled: boolean) => {
        setScoreBonuses((current) => {
            const next = { ...current, [bonus]: enabled };
            saveStoredScoreBonuses(next);
            return next;
        });
    }, []);

    useEffect(() => {
        if (autoLoadStarted) return;
        autoLoadStarted = true;
        loadFromSavedFolder().catch(() => {
            // Errors are surfaced through store state.
        });
    }, [loadFromSavedFolder]);

    const value = useMemo(() => ({
        sessions,
        index,
        trainerName,
        trainerNameOverride,
        debugMode,
        scoreBonuses,
        dataSource,
        folderName,
        lastLoadedAt,
        latestFileName,
        loading,
        hasTriedSavedFolder,
        progress,
        error,
        loadFromFolder,
        reload,
        saveTrainerNameOverride,
        setDebugMode,
        setScoreBonusEnabled,
    }), [
        sessions,
        index,
        trainerName,
        trainerNameOverride,
        debugMode,
        scoreBonuses,
        dataSource,
        folderName,
        lastLoadedAt,
        latestFileName,
        loading,
        hasTriedSavedFolder,
        progress,
        error,
        loadFromFolder,
        reload,
        saveTrainerNameOverride,
        setDebugMode,
        setScoreBonusEnabled,
    ]);

    return (
        <RaceStoreContext.Provider value={value}>{children}</RaceStoreContext.Provider>
    );
}

export function useRaceStore() {
    const ctx = useContext(RaceStoreContext);
    if (!ctx) throw new Error('useRaceStore must be used within RaceStoreProvider');
    return ctx;
}

