import { parseTeamTrialSession } from '../parsers/teamTrials';
import type { TTSession } from '../analytics/types';

const DB_NAME = 'team-umalysis';
const DB_VERSION = 1;
const HANDLE_STORE = 'directory-handles';
/** Max concurrent file read+parse tasks on the main thread. */
const LOAD_CONCURRENCY = 2;
/**
 * Newest N files are parsed first so Recent (100) views can render before
 * older sessions finish loading in the background.
 */
export const PRIORITY_SESSION_LOAD_COUNT = 100;

export type DataSource = 'folder';
export type FolderLoadResult = {
    folderName: string;
    latestFileName: string;
    sessions: TTSession[];
};

export type SessionLoadHandlers = {
    onProgress?: (loaded: number, total: number) => void;
    /**
     * Fired once after the newest {@link PRIORITY_SESSION_LOAD_COUNT} sessions
     * are ready, only when older files still remain to load.
     */
    onPriorityReady?: (partial: FolderLoadResult) => void;
};

type LoadedSessions = {
    latestFileName: string;
    sessions: TTSession[];
};

type NamedFile = { name: string; file: File };

/** Run `fn` over `items` with at most `concurrency` tasks in flight. Results keep input order. */
async function mapPool<T, R>(
    items: T[],
    concurrency: number,
    fn: (item: T) => Promise<R>,
): Promise<R[]> {
    const results = new Array<R>(items.length);
    let nextIndex = 0;

    async function worker() {
        while (true) {
            const i = nextIndex;
            nextIndex += 1;
            if (i >= items.length) return;
            results[i] = await fn(items[i]);
        }
    }

    const workerCount = Math.min(Math.max(1, concurrency), items.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(HANDLE_STORE)) {
                db.createObjectStore(HANDLE_STORE);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function saveDirectoryHandle(handle: FileSystemDirectoryHandle) {
    const db = await openDb();
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    tx.objectStore(HANDLE_STORE).put(handle, 'data-folder');
    await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

async function loadDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
    try {
        const db = await openDb();
        const tx = db.transaction(HANDLE_STORE, 'readonly');
        const req = tx.objectStore(HANDLE_STORE).get('data-folder');
        const handle = await new Promise<FileSystemDirectoryHandle | undefined>((resolve, reject) => {
            req.onsuccess = () => resolve(req.result as FileSystemDirectoryHandle | undefined);
            req.onerror = () => reject(req.error);
        });
        db.close();
        return handle ?? null;
    } catch {
        return null;
    }
}

export async function pickFolderAndLoadSessions(
    handlers: SessionLoadHandlers = {},
    onFolderSelected?: () => void,
): Promise<FolderLoadResult> {
    if (!('showDirectoryPicker' in window)) {
        throw new Error('Folder picker is not supported in this browser. Use Chrome or Edge to load Team Trials files directly.');
    }
    const handle = await window.showDirectoryPicker({ mode: 'read' });
    onFolderSelected?.();
    await saveDirectoryHandle(handle);
    const loaded = await loadSessionsFromHandle(handle, handlers);
    return {
        folderName: handle.name,
        latestFileName: loaded.latestFileName,
        sessions: loaded.sessions,
    };
}

export async function loadSessionsFromSavedFolder(
    handlers: SessionLoadHandlers = {},
): Promise<FolderLoadResult | null> {
    const handle = await loadDirectoryHandle();
    if (!handle) return null;
    try {
        const perm = await handle.queryPermission({ mode: 'read' });
        if (perm !== 'granted') {
            const req = await handle.requestPermission({ mode: 'read' });
            if (req !== 'granted') return null;
        }
        const loaded = await loadSessionsFromHandle(handle, handlers);
        return {
            folderName: handle.name,
            latestFileName: loaded.latestFileName,
            sessions: loaded.sessions,
        };
    } catch {
        return null;
    }
}

async function parseSessionFiles(
    files: NamedFile[],
    totalFiles: number,
    progress: { loaded: number },
    onProgress?: (loaded: number, total: number) => void,
): Promise<TTSession[]> {
    if (files.length === 0) return [];
    const outcomes = await mapPool(files, LOAD_CONCURRENCY, async ({ name, file }) => {
        const text = await file.text();
        const json = JSON.parse(text);
        const session = parseTeamTrialSession(json, name);
        progress.loaded += 1;
        onProgress?.(progress.loaded, totalFiles);
        return 'error' in session ? null : session;
    });
    return outcomes.filter((session): session is TTSession => session !== null);
}

async function loadSessionsFromHandle(
    handle: FileSystemDirectoryHandle,
    handlers: SessionLoadHandlers = {},
): Promise<LoadedSessions> {
    const { onProgress, onPriorityReady } = handlers;
    const files: NamedFile[] = [];
    for await (const entry of handle.values()) {
        if (entry.kind === 'file' && /^TT-.*\.json$/i.test(entry.name)) {
            const file = await entry.getFile();
            files.push({ name: entry.name, file });
        }
    }
    // Newest first (TT-YYYYMMDD_HHMMSS_… names sort chronologically).
    files.sort((a, b) => b.name.localeCompare(a.name));
    const latestFileName = files[0]?.name ?? '';
    const totalFiles = files.length;
    onProgress?.(0, totalFiles);

    const priorityFiles = files.slice(0, PRIORITY_SESSION_LOAD_COUNT);
    const remainingFiles = files.slice(PRIORITY_SESSION_LOAD_COUNT);
    const progress = { loaded: 0 };

    const prioritySessions = await parseSessionFiles(priorityFiles, totalFiles, progress, onProgress);

    if (remainingFiles.length > 0) {
        onPriorityReady?.({
            folderName: handle.name,
            latestFileName,
            sessions: prioritySessions,
        });
        // Let React commit + paint the Recent dashboard before older files burn CPU.
        await new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => resolve());
            });
        });
        const olderSessions = await parseSessionFiles(remainingFiles, totalFiles, progress, onProgress);
        return {
            latestFileName,
            sessions: [...prioritySessions, ...olderSessions],
        };
    }

    return { latestFileName, sessions: prioritySessions };
}
