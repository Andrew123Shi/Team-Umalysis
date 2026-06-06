import { useEffect, useState } from 'react';
import { Alert, Container, Nav, Navbar, Spinner } from 'react-bootstrap';
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
    const { reload, loading, dataSource, index } = useRaceStore();
    useStickyOffset(headerEl, '--sticky-app-header-height');

    return (
        <div ref={setHeaderEl} className="app-fixed-header">
            <Navbar variant="dark" expand="lg" className="app-nav">
                <Container fluid>
                    <Navbar.Brand as={Link} to="/">
                        <img src="/icon.ico" alt="" className="app-brand-mark" aria-hidden="true" />
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
                                <span className={`app-status-dot${index.length > 0 ? ' is-ready' : ''}`} aria-hidden="true" />
                                {index.length > 0 ? (
                                    <>
                                        <strong>{index.length}</strong>
                                        {` Team Trials file${index.length === 1 ? '' : 's'} loaded from ${dataSource ?? 'unknown'}`}
                                    </>
                                ) : (
                                    'No Team Trials files loaded'
                                )}
                            </span>
                            <Nav.Link onClick={() => reload()} className={loading ? 'disabled' : ''}>Reload Data</Nav.Link>
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
        return (
            <Container className="py-5">
                <div className="page-hero text-center">
                    <div className="page-hero-content">
                        <div className="page-eyebrow justify-content-center">Loading Assets</div>
                        <h1>Team Umalysis</h1>
                        <div className="mt-3 text-secondary">
                            <Spinner animation="border" size="sm" className="me-2" />
                            Loading game database...
                        </div>
                    </div>
                </div>
            </Container>
        );
    }
    return <>{children}</>;
}

export default function App() {
    return (
        <BrowserRouter>
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
