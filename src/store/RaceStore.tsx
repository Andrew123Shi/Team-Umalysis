import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { SessionIndexEntry, TTSession } from '../analytics/types';

import { getSessionOpponentTrainer, resolvePlayerIdentity } from '../analytics/umaIdentity';

import {

    fetchSessionIndex,

    fetchServerConfig,

    loadSessionsFromSavedFolder,

    loadSessionsFromServer,

    pickFolderAndLoadSessions,

    type DataSource,

} from '../data/raceLoader';



type RaceStoreValue = {

    sessions: TTSession[];

    index: SessionIndexEntry[];

    trainerName: string;

    dataSource: DataSource | null;

    loading: boolean;

    progress: { loaded: number; total: number };

    error: string;

    loadFromServer: () => Promise<void>;

    loadFromFolder: () => Promise<void>;

    reload: () => Promise<void>;

};



const RaceStoreContext = createContext<RaceStoreValue | null>(null);

/** Survives StrictMode remount so auto-load only runs once per page load. */
let autoLoadStarted = false;



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

    const [dataSource, setDataSource] = useState<DataSource | null>(null);

    const [loading, setLoading] = useState(false);

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



    const loadFromServer = useCallback(async () => {

        setLoading(true);

        setError('');

        try {

            const cfg = await fetchServerConfig();

            await fetchSessionIndex();

            const parsed = await loadSessionsFromServer(onProgress);

            finalizeSessions(parsed, cfg.trainerName);

            setDataSource('server');

        } catch (err: any) {

            setError(err.message ?? String(err));

        } finally {

            setLoading(false);

        }

    }, [onProgress, finalizeSessions]);



    const loadFromFolder = useCallback(async () => {

        setLoading(true);

        setError('');

        try {

            let parsed = await loadSessionsFromSavedFolder(onProgress);

            if (!parsed) parsed = await pickFolderAndLoadSessions(onProgress);

            const cfg = await fetchServerConfig().catch(() => ({ dataPath: '', trainerName: '' }));

            finalizeSessions(parsed, cfg.trainerName);

            setDataSource('folder');

        } catch (err: any) {

            setError(err.message ?? String(err));

        } finally {

            setLoading(false);

        }

    }, [onProgress, finalizeSessions]);



    const reload = useCallback(async () => {

        if (dataSource === 'folder') await loadFromFolder();

        else await loadFromServer();

    }, [dataSource, loadFromFolder, loadFromServer]);



    useEffect(() => {
        if (autoLoadStarted) return;
        autoLoadStarted = true;
        loadFromServer().catch(() => {
            // Server may be offline; user can use folder picker.
        });
    }, [loadFromServer]);



    const value = useMemo(() => ({

        sessions,

        index,

        trainerName,

        dataSource,

        loading,

        progress,

        error,

        loadFromServer,

        loadFromFolder,

        reload,

    }), [sessions, index, trainerName, dataSource, loading, progress, error, loadFromServer, loadFromFolder, reload]);



    return (

        <RaceStoreContext.Provider value={value}>{children}</RaceStoreContext.Provider>

    );

}



export function useRaceStore() {

    const ctx = useContext(RaceStoreContext);

    if (!ctx) throw new Error('useRaceStore must be used within RaceStoreProvider');

    return ctx;

}

