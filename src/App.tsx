import { useEffect, useState } from 'react';
import { Alert, Container, Nav, Navbar } from 'react-bootstrap';
import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import './App.css';
import './dark-mode.css';
import UMDatabaseWrapper from './data/UMDatabaseWrapper';
import GameDataLoader from './data/GameDataLoader';
import { useStickyOffset } from './hooks/useStickyOffset';
import AppFooter from './components/AppFooter';
import DashboardPage from './pages/DashboardPage';
import ReplayPage from './pages/ReplayPage';
import SettingsPage from './pages/SettingsPage';
import { RaceStoreProvider, useRaceStore } from './store/RaceStore';

function AppHeader() {
    const [headerEl, setHeaderEl] = useState<HTMLDivElement | null>(null);
    const { reload, loading, index, progress } = useRaceStore();
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
        <div ref={setHeaderEl} className="app-fixed-header">
            <Navbar variant="dark" expand="lg" className="app-nav">
                <Container fluid>
                    <Navbar.Brand as={Link} to="/">
                        <img src={`${baseUrl}icon.ico`} alt="" className="app-brand-mark" aria-hidden="true" />
                        <span className="app-brand-text">Team Umalysis</span>
                    </Navbar.Brand>
                    <Navbar.Toggle aria-controls="nav" />
                    <Navbar.Collapse id="nav">
                        <Nav className="me-auto">
                            <Nav.Link as={NavLink} to="/" end>Dashboard</Nav.Link>
                            <Nav.Link as={NavLink} to="/replay">Replay</Nav.Link>
                            <Nav.Link as={NavLink} to="/settings">Settings</Nav.Link>
                        </Nav>
                        <Nav>
                            <span className="navbar-text app-data-status me-3">
                                <span className={statusDotClass} aria-hidden="true" />
                                {displayedFileCount > 0 ? (
                                    <>
                                        <strong>{statusFileCount}</strong>
                                        {` Team Trials file${displayedFileCount === 1 ? '' : 's'} loaded`}
                                    </>
                                ) : (
                                    loading ? 'Loading Team Trials files...' : 'No Team Trials files loaded'
                                )}
                            </span>
                            <Nav.Link onClick={() => reload()} className={loading ? 'disabled' : ''}>Reload Folder</Nav.Link>
                        </Nav>
                    </Navbar.Collapse>
                </Container>
            </Navbar>
        </div>
    );
}

function AppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<DashboardPage />} />
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
            <Container className="py-5">
                <div className="page-hero">
                    <div className="page-hero-content">
                        <div className="page-eyebrow">Boot Error</div>
                        <h1>Team Umalysis</h1>
                        <Alert variant="danger" className="mt-3 mb-0">Failed to load game data: {bootError}</Alert>
                    </div>
                </div>
            </Container>
        );
    }
    if (!ready) {
        return null;
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
                            <Container fluid className="pb-5">
                                <AppRoutes />
                            </Container>
                        </main>
                        <AppFooter />
                    </div>
                </RaceStoreProvider>
            </BootstrapGate>
        </BrowserRouter>
    );
}
