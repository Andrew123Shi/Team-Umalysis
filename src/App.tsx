import { useEffect, useState } from 'react';
import { Alert } from 'react-bootstrap';
import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import './App.css';
import './dark-mode.css';
import UMDatabaseWrapper from './data/UMDatabaseWrapper';
import GameDataLoader from './data/GameDataLoader';
import { useStickyOffset } from './hooks/useStickyOffset';
import AppFooter from './components/AppFooter';
import DashboardLayout from './pages/dashboard/DashboardLayout';
import DistanceAnalysisPage from './pages/dashboard/DistanceAnalysisPage';
import OverviewPage from './pages/dashboard/OverviewPage';
import UmaAnalysisPage from './pages/dashboard/UmaAnalysisPage';
import ReplayPage from './pages/ReplayPage';
import SettingsPage from './pages/SettingsPage';
import { RaceStoreProvider, useRaceProgress, useRaceStore } from './store/RaceStore';

const NAV_ITEMS = [
    { to: '/', label: 'Overview', end: true },
    { to: '/uma', label: 'Uma Analysis' },
    { to: '/distance', label: 'Distance Analysis' },
    { to: '/replay', label: 'Replay' },
    { to: '/settings', label: 'Settings' },
] as const;

function ReloadIcon() {
    return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M13.5 8a5.5 5.5 0 1 1-1.61-3.89" />
            <path d="M13.5 2.5v3.25h-3.25" />
        </svg>
    );
}

function AppHeader() {
    const [headerEl, setHeaderEl] = useState<HTMLElement | null>(null);
    const { reload, loading, index } = useRaceStore();
    const { progress } = useRaceProgress();
    useStickyOffset(headerEl, '--sticky-app-header-height');
    const baseUrl = import.meta.env.BASE_URL;

    const displayedFileCount = loading && progress.total > 0 ? progress.loaded : index.length;
    const statusFileCount = loading && progress.total > 0
        ? `${progress.loaded}/${progress.total}`
        : String(displayedFileCount);
    const statusDotClass = [
        'app-status-dot',
        loading ? 'is-loading' : '',
        !loading && index.length > 0 ? 'is-ready' : '',
    ].filter(Boolean).join(' ');

    return (
        <header ref={setHeaderEl} className="app-header">
            <div className="app-header-inner">
                <Link to="/" className="app-brand">
                    <img src={`${baseUrl}icon.ico`} alt="" className="app-brand-mark" aria-hidden="true" />
                    <span className="app-brand-text">Team Umalysis</span>
                    <span className="app-brand-badge">v2.0</span>
                </Link>
                <nav className="app-nav" aria-label="Primary">
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={'end' in item ? item.end : undefined}
                            className="app-nav-link"
                        >
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
                <div className="app-header-tools">
                    <span className="app-data-status">
                        <span className={statusDotClass} aria-hidden="true" />
                        {displayedFileCount > 0 ? (
                            <>
                                <strong>{statusFileCount}</strong>
                                <span className="app-data-status-label">
                                    {` file${displayedFileCount === 1 ? '' : 's'}${loading ? ' loading' : ' loaded'}`}
                                </span>
                            </>
                        ) : (
                            <span className="app-data-status-label">{loading ? 'Loading files…' : 'No files loaded'}</span>
                        )}
                    </span>
                    <button
                        type="button"
                        className={`app-icon-btn${loading ? ' is-spinning' : ''}`}
                        onClick={() => reload()}
                        disabled={loading}
                        aria-label="Reload folder"
                    >
                        <ReloadIcon />
                        <span className="app-icon-btn-label">Reload</span>
                    </button>
                </div>
            </div>
        </header>
    );
}

function AppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<DashboardLayout />}>
                <Route index element={<OverviewPage />} />
                <Route path="uma" element={<UmaAnalysisPage />} />
                <Route path="uma/:umaSlug" element={<UmaAnalysisPage />} />
                <Route path="distance" element={<DistanceAnalysisPage />} />
            </Route>
            <Route path="/replay" element={<ReplayPage />} />
            <Route path="/settings" element={<SettingsPage />} />
        </Routes>
    );
}

function BootstrapGate({ children }: { children: React.ReactNode }) {
    const [ready, setReady] = useState(false);
    const [bootError, setBootError] = useState('');

    useEffect(() => {
        Promise.all([UMDatabaseWrapper.initialize(), GameDataLoader.initialize()])
            .then(() => setReady(true))
            .catch((err) => setBootError(err.message ?? String(err)));
    }, []);

    if (bootError) {
        return (
            <div className="app-boot">
                <div className="app-boot-card">
                    <div className="app-boot-kicker">Boot error</div>
                    <h1 className="app-boot-title">Team Umalysis</h1>
                    <Alert variant="danger" className="mt-3 mb-0">Failed to load game data: {bootError}</Alert>
                </div>
            </div>
        );
    }
    if (!ready) {
        return (
            <div className="app-boot" aria-busy="true">
                <div className="app-boot-loader">
                    <span className="app-boot-kicker">Loading game data</span>
                    <span className="app-boot-bar" />
                </div>
            </div>
        );
    }
    return <>{children}</>;
}

export default function App() {
    return (
        <BrowserRouter basename={import.meta.env.BASE_URL}>
            <BootstrapGate>
                <RaceStoreProvider>
                    <div data-bs-theme="dark" className="app-shell">
                        <AppHeader />
                        <main className="app-main">
                            <div className="app-container">
                                <AppRoutes />
                            </div>
                        </main>
                        <AppFooter />
                    </div>
                </RaceStoreProvider>
            </BootstrapGate>
        </BrowserRouter>
    );
}
