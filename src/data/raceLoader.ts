import { parseTeamTrialSession } from '../parsers/teamTrials';
import type { SessionIndexEntry, TTSession } from '../analytics/types';

const DB_NAME = 'team-umalysis';
const DB_VERSION = 1;
const HANDLE_STORE = 'directory-handles';

export type DataSource = 'server' | 'folder';

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

export type ServerConfig = { dataPath: string; trainerName: string };

export async function fetchSessionIndex(): Promise<{
    dataPath: string;
    trainerName: string;
    sessions: SessionIndexEntry[];
}> {
    const res = await fetch('/api/sessions');
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function fetchSessionJson(id: string): Promise<any> {
    const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.json;
}

export async function loadSessionsFromServer(
    onProgress?: (loaded: number, total: number) => void,
): Promise<TTSession[]> {
    const { sessions } = await fetchSessionIndex();
    const parsed: TTSession[] = [];
    let i = 0;
    for (const entry of sessions) {
        const json = await fetchSessionJson(entry.id);
        const session = parseTeamTrialSession(json, entry.fileName);
        if (!('error' in session)) parsed.push(session);
        i += 1;
        onProgress?.(i, sessions.length);
    }
    return parsed;
}

export async function pickFolderAndLoadSessions(
    onProgress?: (loaded: number, total: number) => void,
): Promise<TTSession[]> {
    if (!('showDirectoryPicker' in window)) {
        throw new Error('Folder picker is not supported in this browser. Use the local server mode.');
    }
    const handle = await window.showDirectoryPicker({ mode: 'read' });
    await saveDirectoryHandle(handle);
    return loadSessionsFromHandle(handle, onProgress);
}

export async function loadSessionsFromSavedFolder(
    onProgress?: (loaded: number, total: number) => void,
): Promise<TTSession[] | null> {
    const handle = await loadDirectoryHandle();
    if (!handle) return null;
    try {
        const perm = await handle.queryPermission({ mode: 'read' });
        if (perm !== 'granted') {
            const req = await handle.requestPermission({ mode: 'read' });
            if (req !== 'granted') return null;
        }
        return loadSessionsFromHandle(handle, onProgress);
    } catch {
        return null;
    }
}

async function loadSessionsFromHandle(
    handle: FileSystemDirectoryHandle,
    onProgress?: (loaded: number, total: number) => void,
): Promise<TTSession[]> {
    const files: { name: string; file: File }[] = [];
    for await (const entry of handle.values()) {
        if (entry.kind === 'file' && /^TT-.*\.json$/i.test(entry.name)) {
            const file = await entry.getFile();
            files.push({ name: entry.name, file });
        }
    }
    files.sort((a, b) => b.name.localeCompare(a.name));
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
    return parsed;
}

export async function fetchServerConfig(): Promise<ServerConfig> {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error(await res.text());
    const cfg = await res.json() as Partial<ServerConfig>;
    return {
        dataPath: cfg.dataPath ?? '',
        trainerName: cfg.trainerName ?? '',
    };
}

export async function updateServerConfig(config: ServerConfig): Promise<ServerConfig> {
    const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? res.statusText);
    }
    const saved = await res.json() as Partial<ServerConfig>;
    return {
        dataPath: saved.dataPath ?? config.dataPath,
        trainerName: saved.trainerName ?? config.trainerName,
    };
}
