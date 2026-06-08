import { parseTeamTrialSession } from '../parsers/teamTrials';
import type { TTSession } from '../analytics/types';

const DB_NAME = 'team-umalysis';
const DB_VERSION = 1;
const HANDLE_STORE = 'directory-handles';

export type DataSource = 'folder';
export type FolderLoadResult = {
    folderName: string;
    latestFileName: string;
    sessions: TTSession[];
};

type LoadedSessions = {
    latestFileName: string;
    sessions: TTSession[];
};

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
    onProgress?: (loaded: number, total: number) => void,
    onFolderSelected?: () => void,
): Promise<FolderLoadResult> {
    if (!('showDirectoryPicker' in window)) {
        throw new Error('Folder picker is not supported in this browser. Use Chrome or Edge to load Team Trials files directly.');
    }
    const handle = await window.showDirectoryPicker({ mode: 'read' });
    onFolderSelected?.();
    await saveDirectoryHandle(handle);
    const loaded = await loadSessionsFromHandle(handle, onProgress);
    return {
        folderName: handle.name,
        latestFileName: loaded.latestFileName,
        sessions: loaded.sessions,
    };
}

export async function loadSessionsFromSavedFolder(
    onProgress?: (loaded: number, total: number) => void,
): Promise<FolderLoadResult | null> {
    const handle = await loadDirectoryHandle();
    if (!handle) return null;
    try {
        const perm = await handle.queryPermission({ mode: 'read' });
        if (perm !== 'granted') {
            const req = await handle.requestPermission({ mode: 'read' });
            if (req !== 'granted') return null;
        }
        const loaded = await loadSessionsFromHandle(handle, onProgress);
        return {
            folderName: handle.name,
            latestFileName: loaded.latestFileName,
            sessions: loaded.sessions,
        };
    } catch {
        return null;
    }
}

async function loadSessionsFromHandle(
    handle: FileSystemDirectoryHandle,
    onProgress?: (loaded: number, total: number) => void,
): Promise<LoadedSessions> {
    const files: { name: string; file: File }[] = [];
    for await (const entry of handle.values()) {
        if (entry.kind === 'file' && /^TT-.*\.json$/i.test(entry.name)) {
            const file = await entry.getFile();
            files.push({ name: entry.name, file });
        }
    }
    files.sort((a, b) => b.name.localeCompare(a.name));
    const latestFileName = files[0]?.name ?? '';
    const parsed: TTSession[] = [];
    let i = 0;
    for (const { name, file } of files) {
        const text = await file.text();
        const json = JSON.parse(text);
        const session = parseTeamTrialSession(json, name);
        if (!('error' in session)) parsed.push(session);
        i += 1;
        onProgress?.(i, files.length);
    }
    return { latestFileName, sessions: parsed };
}
