import { useEffect, useState } from 'react';
import isMobile from 'is-mobile';
import { XMarkIcon } from '@heroicons/react/24/outline';

export default function MobileHint() {
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    // Check if mobile/tablet and not previously dismissed
    const isDismissed = localStorage.getItem('mobileHintDismissed') === 'true';
    const isMobileDevice = isMobile({ tablet: true, featureDetect: true });
    setShowHint(isMobileDevice && !isDismissed);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('mobileHintDismissed', 'true');
    setShowHint(false);
  };

  if (!showHint) return null;

  return (
    <div
      style={{
        background: '#fff3cd',
        color: '#856404',
        padding: '0.75rem',
        textAlign: 'center',
        fontSize: '0.9rem',
        borderBottom: '1px solid #ffeaa7',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem'
      }}
    >
      <span>Best viewed on desktop for now.</span>
      <button
        onClick={handleDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '0.25rem',
          display: 'flex',
          alignItems: 'center',
          color: '#856404'
        }}
        aria-label="Dismiss"
      >
        <XMarkIcon style={{ width: '20px', height: '20px' }} />
      </button>
    </div>
  );
}
