import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { ScoreBonusKey, ScoreBonusSettings, SessionIndexEntry, TTSession } from '../analytics/types';

import { getSessionOpponentTrainer, resolvePlayerIdentity } from '../analytics/umaIdentity';
import {
    loadSessionsFromSavedFolder,
    pickFolderAndLoadSessions,
    type DataSource,
    type FolderLoadResult,
    type SessionLoadHandlers,
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
    /** True after the Recent priority batch while older files are still parsing. */
    loadingRemaining: boolean;
    hasTriedSavedFolder: boolean;
    error: string;
    loadFromFolder: () => Promise<void>;
    reload: () => Promise<void>;
    saveTrainerNameOverride: (value: string) => void;
    setDebugMode: (enabled: boolean) => void;
    setScoreBonusEnabled: (bonus: ScoreBonusKey, enabled: boolean) => void;
};

type RaceProgressValue = {
    loading: boolean;
    loadingRemaining: boolean;
    progress: { loaded: number; total: number };
};

const RaceStoreContext = createContext<RaceStoreValue | null>(null);
const RaceProgressContext = createContext<RaceProgressValue | null>(null);

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
    const [loadingRemaining, setLoadingRemaining] = useState(false);
    const [hasTriedSavedFolder, setHasTriedSavedFolder] = useState(false);
    const [progress, setProgress] = useState({ loaded: 0, total: 0 });
    const [error, setError] = useState('');
    const loadGenerationRef = useRef(0);
    const trainerNameOverrideRef = useRef(trainerNameOverride);
    const progressRafRef = useRef<number | null>(null);
    const pendingProgressRef = useRef<{ loaded: number; total: number } | null>(null);
    trainerNameOverrideRef.current = trainerNameOverride;

    const flushProgress = useCallback(() => {
        progressRafRef.current = null;
        const pending = pendingProgressRef.current;
        if (!pending) return;
        pendingProgressRef.current = null;
        setProgress(pending);
    }, []);

    const onProgress = useCallback((loaded: number, total: number) => {
        pendingProgressRef.current = { loaded, total };
        if (progressRafRef.current !== null) return;
        progressRafRef.current = requestAnimationFrame(flushProgress);
    }, [flushProgress]);

    const finalizeSessions = useCallback((parsed: TTSession[], configuredTrainer: string) => {
        const identity = resolvePlayerIdentity(parsed, configuredTrainer);
        setTrainerName(identity.trainerName);
        setSessions(parsed);
        setIndex(parsed.map(buildIndexEntry));
    }, []);

    const applyFolderResult = useCallback((result: FolderLoadResult) => {
        finalizeSessions(result.sessions, trainerNameOverrideRef.current);
        setFolderName(result.folderName);
        setLatestFileName(result.latestFileName);
        setDataSource('folder');
    }, [finalizeSessions]);

    const beginLoad = useCallback(() => {
        const generation = loadGenerationRef.current + 1;
        loadGenerationRef.current = generation;
        if (progressRafRef.current !== null) {
            cancelAnimationFrame(progressRafRef.current);
            progressRafRef.current = null;
        }
        pendingProgressRef.current = null;
        setLoading(true);
        setLoadingRemaining(false);
        setError('');
        setProgress({ loaded: 0, total: 0 });
        setSessions([]);
        setIndex([]);
        return generation;
    }, []);

    const endLoad = useCallback((generation: number) => {
        if (generation !== loadGenerationRef.current) return;
        if (progressRafRef.current !== null) {
            cancelAnimationFrame(progressRafRef.current);
            progressRafRef.current = null;
        }
        const pending = pendingProgressRef.current;
        if (pending) {
            pendingProgressRef.current = null;
            setProgress(pending);
        }
        setLoadingRemaining(false);
        setLoading(false);
    }, []);

    const makeLoadHandlers = useCallback((generation: number): SessionLoadHandlers => ({
        onProgress: (loaded, total) => {
            if (generation !== loadGenerationRef.current) return;
            onProgress(loaded, total);
        },
        onPriorityReady: (partial) => {
            if (generation !== loadGenerationRef.current) return;
            applyFolderResult(partial);
            setLoadingRemaining(true);
            setLastLoadedAt(new Date());
        },
    }), [applyFolderResult, onProgress]);

    const finishLoadIfCurrent = useCallback((generation: number, result: FolderLoadResult) => {
        if (generation !== loadGenerationRef.current) return;
        applyFolderResult(result);
        setLastLoadedAt(new Date());
        setDataSource('folder');
        setHasTriedSavedFolder(true);
    }, [applyFolderResult]);

    const loadFromSavedFolder = useCallback(async () => {
        const generation = beginLoad();
        try {
            const result = await loadSessionsFromSavedFolder(makeLoadHandlers(generation));
            if (generation !== loadGenerationRef.current) return;
            if (!result) {
                setDataSource(null);
                return;
            }
            finishLoadIfCurrent(generation, result);
        } catch (err: any) {
            if (generation === loadGenerationRef.current) {
                setError(err.message ?? String(err));
            }
        } finally {
            if (generation === loadGenerationRef.current) {
                setHasTriedSavedFolder(true);
                endLoad(generation);
            }
        }
    }, [beginLoad, endLoad, finishLoadIfCurrent, makeLoadHandlers]);

    const loadFromFolder = useCallback(async () => {
        setError('');
        setProgress({ loaded: 0, total: 0 });
        // Generation is assigned only after the user confirms the folder picker.
        let generation = 0;
        const handlers: SessionLoadHandlers = {
            onProgress: (loaded, total) => {
                if (!generation || generation !== loadGenerationRef.current) return;
                onProgress(loaded, total);
            },
            onPriorityReady: (partial) => {
                if (!generation || generation !== loadGenerationRef.current) return;
                applyFolderResult(partial);
                setLoadingRemaining(true);
                setLastLoadedAt(new Date());
            },
        };
        try {
            const result = await pickFolderAndLoadSessions(handlers, () => {
                generation = beginLoad();
            });
            if (!generation || generation !== loadGenerationRef.current) return;
            finishLoadIfCurrent(generation, result);
        } catch (err: any) {
            if (!isAbortError(err) && (!generation || generation === loadGenerationRef.current)) {
                setError(err.message ?? String(err));
            }
        } finally {
            if (!generation || generation === loadGenerationRef.current) {
                endLoad(generation || loadGenerationRef.current);
            }
        }
    }, [applyFolderResult, beginLoad, endLoad, finishLoadIfCurrent, onProgress]);

    const reload = useCallback(async () => {
        const generation = beginLoad();
        try {
            let result = await loadSessionsFromSavedFolder(makeLoadHandlers(generation));
            if (generation !== loadGenerationRef.current) return;
            if (!result) {
                result = await pickFolderAndLoadSessions(
                    makeLoadHandlers(generation),
                    () => {
                        // Picker confirmed; keep the same generation (already begun).
                    },
                );
            }
            if (generation !== loadGenerationRef.current) return;
            finishLoadIfCurrent(generation, result);
        } catch (err: any) {
            if (!isAbortError(err) && generation === loadGenerationRef.current) {
                setError(err.message ?? String(err));
            }
        } finally {
            if (generation === loadGenerationRef.current) {
                setHasTriedSavedFolder(true);
                endLoad(generation);
            }
        }
    }, [beginLoad, endLoad, finishLoadIfCurrent, makeLoadHandlers]);

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

    useEffect(() => () => {
        if (progressRafRef.current !== null) {
            cancelAnimationFrame(progressRafRef.current);
        }
    }, []);

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
        loadingRemaining,
        hasTriedSavedFolder,
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
        loadingRemaining,
        hasTriedSavedFolder,
        error,
        loadFromFolder,
        reload,
        saveTrainerNameOverride,
        setDebugMode,
        setScoreBonusEnabled,
    ]);

    const progressValue = useMemo(() => ({
        loading,
        loadingRemaining,
        progress,
    }), [loading, loadingRemaining, progress]);

    return (
        <RaceStoreContext.Provider value={value}>
            <RaceProgressContext.Provider value={progressValue}>
                {children}
            </RaceProgressContext.Provider>
        </RaceStoreContext.Provider>
    );
}

export function useRaceStore() {
    const ctx = useContext(RaceStoreContext);
    if (!ctx) throw new Error('useRaceStore must be used within RaceStoreProvider');
    return ctx;
}

/** Subscribe only to load progress — does not re-render dashboard data consumers. */
export function useRaceProgress() {
    const ctx = useContext(RaceProgressContext);
    if (!ctx) throw new Error('useRaceProgress must be used within RaceStoreProvider');
    return ctx;
}
