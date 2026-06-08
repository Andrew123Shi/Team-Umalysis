import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { SessionIndexEntry, TTSession } from '../analytics/types';

import { getSessionOpponentTrainer, resolvePlayerIdentity } from '../analytics/umaIdentity';
import {
    loadSessionsFromSavedFolder,
    pickFolderAndLoadSessions,
    type DataSource,
} from '../data/raceLoader';

const TRAINER_OVERRIDE_KEY = 'team-umalysis-trainer-name-override';

type RaceStoreValue = {
    sessions: TTSession[];
    index: SessionIndexEntry[];
    trainerName: string;
    trainerNameOverride: string;
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
        totalTeamScore: session.rounds.reduce((sum, r) => sum + r.teamTotalScore, 0),
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
        setLoading(true);
        setError('');
        setProgress({ loaded: 0, total: 0 });
        try {
            const result = await pickFolderAndLoadSessions(onProgress);
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
    }), [
        sessions,
        index,
        trainerName,
        trainerNameOverride,
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

