import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import LandingPage from './pages/LandingPage.tsx'
import SimulatorPage from './pages/SimulatorPage.tsx'
import AboutPage from './pages/AboutPage.tsx'

// Simple client-side routing based on path
const App = () => {
  const path = window.location.pathname;

  if (path === '/simulator' || path === '/simulator.html') {
    return <SimulatorPage />;
  }

  if (path === '/about' || path === '/about.html') {
    return <AboutPage />;
  }

  return <LandingPage />;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
