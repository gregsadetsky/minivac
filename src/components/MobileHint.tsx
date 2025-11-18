import { useEffect, useState } from 'react';
import isMobile from 'is-mobile';

export default function MobileHint() {
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    // Check if mobile/tablet on mount
    setShowHint(isMobile({ tablet: true, featureDetect: true }));
  }, []);

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
        zIndex: 1000
      }}
    >
      Best viewed on desktop for now.
    </div>
  );
}
