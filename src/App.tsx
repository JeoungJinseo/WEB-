import './App.css';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';

import { lazy, Suspense, useEffect } from 'react';
const OvenImageTube = lazy(() => import('./components/pages/image-tube/oven-image-tube'));
import { CylinderCarousel } from './components/pages/variant-1/cylinder-carousel';
import CinematicSceneShowcase from './components/pages/variant-2/cinematic-scene-showcase';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function BodyClassSetter() {
  const location = useLocation();

  useEffect(() => {
    document.body.classList.remove('demo-1', 'demo-2', 'demo-tube');

    if (location.pathname === '/') {
      document.body.classList.add('demo-1');
    } else if (location.pathname === '/tube') {
      document.body.classList.add('demo-1', 'demo-tube');
    } else if (location.pathname === '/variant-2') {
      document.body.classList.add('demo-2');
    }
  }, [location.pathname]);

  return null;
}

function App() {
  return (
    <Router>
      <ScrollToTop />
      <BodyClassSetter />
      <main id="main-content" className="" role="main">
        <Routes>
          <Route path="/" element={<CylinderCarousel />} />
          <Route path="/tube" element={<Suspense fallback={null}><OvenImageTube /></Suspense>} />
          <Route path="/variant-2" element={<CinematicSceneShowcase />} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
