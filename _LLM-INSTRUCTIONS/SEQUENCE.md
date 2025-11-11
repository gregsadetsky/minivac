# Minivac 601 Implementation Plan - Step by Step

## Phase 1: Single Hole Component (Visual Only)

### Step 1.1: Project Setup
```bash
npx create-react-app minivac-601
cd minivac-601
npm start
```

### Step 1.2: Create Basic Hole Component
**Goal**: See a single hole on screen with proper styling

**File**: `src/components/primitives/Hole.jsx`
```jsx
export default function Hole({ size = 10 }) {
  return (
    <div 
      className="hole"
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
    />
  );
}
```

**File**: `src/components/primitives/Hole.css`
```css
.hole {
  border-radius: 50%;
  background: #1a1a1a;  /* Dark hole center */
  border: 2px solid #888;  /* Silver ring */
  box-shadow: 
    inset 0 2px 4px rgba(0, 0, 0, 0.8),  /* Inner shadow for depth */
    0 0 0 1px rgba(255, 255, 255, 0.1);  /* Subtle outer highlight */
}
```

**File**: `src/App.jsx`
```jsx
import Hole from './components/primitives/Hole';
import './App.css';

function App() {
  return (
    <div className="app">
      <div className="test-container">
        <h1>Hole Component Test</h1>
        <Hole size={10} />
      </div>
    </div>
  );
}

export default App;
```

**File**: `src/App.css`
```css
.app {
  background: #2a2a2a;  /* Minivac board color */
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
}

.test-container {
  background: #1a1a1a;  /* Darker section */
  padding: 40px;
  border: 3px solid #2874A6;
}

.test-container h1 {
  color: #d0d0d0;
  font-family: 'Courier New', monospace;
  margin-bottom: 20px;
  font-size: 16px;
}
```

**Checkpoint**: You should see ONE hole with a silver ring on a dark background.

---

### Step 1.3: Hole Size Variations
**Goal**: Test different hole sizes to find what looks right

**Update**: `src/App.jsx`
```jsx
function App() {
  return (
    <div className="app">
      <div className="test-container">
        <h1>Hole Size Tests</h1>
        <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
          <div>
            <p style={{color: '#888', marginBottom: '10px'}}>8px</p>
            <Hole size={8} />
          </div>
          <div>
            <p style={{color: '#888', marginBottom: '10px'}}>10px</p>
            <Hole size={10} />
          </div>
          <div>
            <p style={{color: '#888', marginBottom: '10px'}}>12px</p>
            <Hole size={12} />
          </div>
          <div>
            <p style={{color: '#888', marginBottom: '10px'}}>14px</p>
            <Hole size={14} />
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Checkpoint**: Decide on the optimal hole size. Adjust silver ring thickness if needed.

---

### Step 1.4: Hole Visual States
**Goal**: Add visual variations (empty, hover state, different styles)

**Update**: `src/components/primitives/Hole.jsx`
```jsx
export default function Hole({ 
  size = 10,
  variant = 'default'  // 'default', 'highlighted'
}) {
  return (
    <div 
      className={`hole hole-${variant}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
    />
  );
}
```

**Update**: `src/components/primitives/Hole.css`
```css
.hole {
  border-radius: 50%;
  background: #1a1a1a;
  border: 2px solid #888;
  box-shadow: 
    inset 0 2px 4px rgba(0, 0, 0, 0.8),
    0 0 0 1px rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: all 0.15s ease;
}

.hole:hover {
  border-color: #aaa;
  box-shadow: 
    inset 0 2px 4px rgba(0, 0, 0, 0.8),
    0 0 0 1px rgba(255, 255, 255, 0.2),
    0 0 8px rgba(255, 255, 255, 0.3);
}

.hole-highlighted {
  border-color: #ffcc00;
  box-shadow: 
    inset 0 2px 4px rgba(0, 0, 0, 0.8),
    0 0 8px rgba(255, 204, 0, 0.5);
}
```

**Update**: `src/App.jsx`
```jsx
function App() {
  return (
    <div className="app">
      <div className="test-container">
        <h1>Hole State Tests</h1>
        <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
          <div>
            <p style={{color: '#888', marginBottom: '10px'}}>Default</p>
            <Hole size={12} />
          </div>
          <div>
            <p style={{color: '#888', marginBottom: '10px'}}>Hover me</p>
            <Hole size={12} />
          </div>
          <div>
            <p style={{color: '#888', marginBottom: '10px'}}>Highlighted</p>
            <Hole size={12} variant="highlighted" />
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Checkpoint**: Hover over holes, verify the hover effect looks good. Check that highlighted state is visible.

---

## Phase 2: Combining Holes (Connectors)

### Step 2.1: Simple Hole Pair
**Goal**: Two holes side by side

**File**: `src/components/connectors/PortPair.jsx`
```jsx
import Hole from '../primitives/Hole';
import './PortPair.css';

export default function PortPair({ 
  spacing = 15,
  holeSize = 10 
}) {
  return (
    <div className="port-pair">
      <Hole size={holeSize} />
      <Hole size={holeSize} />
    </div>
  );
}
```

**File**: `src/components/connectors/PortPair.css`
```css
.port-pair {
  display: flex;
  gap: 15px;
  align-items: center;
}
```

**Update**: `src/App.jsx`
```jsx
import PortPair from './components/connectors/PortPair';

function App() {
  return (
    <div className="app">
      <div className="test-container">
        <h1>Port Pair Test</h1>
        <PortPair />
      </div>
    </div>
  );
}
```

**Checkpoint**: See two holes with proper spacing.

---

### Step 2.2: Port Pair with Label
**Goal**: Add text label above holes

**Update**: `src/components/connectors/PortPair.jsx`
```jsx
import Hole from '../primitives/Hole';
import './PortPair.css';

export default function PortPair({ 
  label = '',
  spacing = 15,
  holeSize = 10 
}) {
  return (
    <div className="port-pair">
      {label && <div className="port-label">{label}</div>}
      <div className="port-holes">
        <Hole size={holeSize} />
        <Hole size={holeSize} />
      </div>
    </div>
  );
}
```

**Update**: `src/components/connectors/PortPair.css`
```css
.port-pair {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.port-label {
  color: #d0d0d0;
  font-family: 'Courier New', monospace;
  font-size: 9px;
  font-weight: bold;
  letter-spacing: 1px;
}

.port-holes {
  display: flex;
  gap: 15px;
}
```

**Update**: `src/App.jsx`
```jsx
function App() {
  return (
    <div className="app">
      <div className="test-container">
        <h1>Port Pair with Labels</h1>
        <div style={{ display: 'flex', gap: '40px' }}>
          <PortPair label="ARM" />
          <PortPair label="COIL" />
          <PortPair label="N.O." />
        </div>
      </div>
    </div>
  );
}
```

**Checkpoint**: See labeled port pairs that look like the real Minivac.

---

### Step 2.3: Port Pair with Sublabels
**Goal**: Add small labels under each hole (like "R", "S", "T")

**Update**: `src/components/connectors/PortPair.jsx`
```jsx
import Hole from '../primitives/Hole';
import './PortPair.css';

export default function PortPair({ 
  label = '',
  sublabels = [],  // e.g., ['R', 'S']
  spacing = 15,
  holeSize = 10 
}) {
  return (
    <div className="port-pair">
      {label && <div className="port-label">{label}</div>}
      <div className="port-holes">
        {sublabels.length > 0 ? (
          sublabels.map((sublabel, i) => (
            <div key={i} className="port-with-sublabel">
              <Hole size={holeSize} />
              {sublabel && <div className="port-sublabel">{sublabel}</div>}
            </div>
          ))
        ) : (
          <>
            <Hole size={holeSize} />
            <Hole size={holeSize} />
          </>
        )}
      </div>
    </div>
  );
}
```

**Update**: `src/components/connectors/PortPair.css`
```css
.port-pair {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.port-label {
  color: #d0d0d0;
  font-family: 'Courier New', monospace;
  font-size: 9px;
  font-weight: bold;
  letter-spacing: 1px;
}

.port-holes {
  display: flex;
  gap: 15px;
}

.port-with-sublabel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.port-sublabel {
  color: #999;
  font-family: 'Courier New', monospace;
  font-size: 8px;
  font-weight: bold;
}
```

**Update**: `src/App.jsx`
```jsx
function App() {
  return (
    <div className="app">
      <div className="test-container">
        <h1>Port Pair with Sublabels</h1>
        <div style={{ display: 'flex', gap: '40px' }}>
          <PortPair label="ARM" sublabels={['R', 'S', 'T']} />
          <PortPair label="COIL" sublabels={['U', 'V']} />
          <PortPair label="" sublabels={['W', 'X']} />
        </div>
      </div>
    </div>
  );
}
```

**Checkpoint**: Verify sublabels appear below holes correctly.

---

## Phase 3: Interactive Button Component

### Step 3.1: Basic Button Visual
**Goal**: Create a large red circular button

**File**: `src/components/primitives/PushButton.jsx`
```jsx
import './PushButton.css';

export default function PushButton({ 
  size = 60,
  color = '#c14a4a'
}) {
  return (
    <div 
      className="push-button"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background: color
      }}
    />
  );
}
```

**File**: `src/components/primitives/PushButton.css`
```css
.push-button {
  border-radius: 50%;
  border: 4px solid #2a2a2a;
  cursor: pointer;
  transition: all 0.1s ease;
  box-shadow: 
    0 4px 8px rgba(0, 0, 0, 0.5),
    inset 0 2px 4px rgba(255, 255, 255, 0.2),
    inset 0 -2px 4px rgba(0, 0, 0, 0.3);
}

.push-button:hover {
  box-shadow: 
    0 4px 8px rgba(0, 0, 0, 0.5),
    inset 0 2px 4px rgba(255, 255, 255, 0.3),
    inset 0 -2px 4px rgba(0, 0, 0, 0.3),
    0 0 12px rgba(193, 74, 74, 0.4);
}

.push-button:active {
  transform: translateY(2px);
  box-shadow: 
    0 2px 4px rgba(0, 0, 0, 0.5),
    inset 0 3px 6px rgba(0, 0, 0, 0.4);
}
```

**Update**: `src/App.jsx`
```jsx
import PushButton from './components/primitives/PushButton';

function App() {
  return (
    <div className="app">
      <div className="test-container">
        <h1>Push Button Test</h1>
        <PushButton />
      </div>
    </div>
  );
}
```

**Checkpoint**: Click and hold the button. It should look pressed. Release and it should pop back up.

---

### Step 3.2: Button with Click Feedback
**Goal**: Add visual feedback and console logging

**Update**: `src/components/primitives/PushButton.jsx`
```jsx
import { useState } from 'react';
import './PushButton.css';

export default function PushButton({ 
  size = 60,
  color = '#c14a4a',
  onPress = () => {},
  onRelease = () => {}
}) {
  const [isPressed, setIsPressed] = useState(false);

  const handleMouseDown = () => {
    setIsPressed(true);
    onPress();
    console.log('Button pressed');
  };

  const handleMouseUp = () => {
    setIsPressed(false);
    onRelease();
    console.log('Button released');
  };

  return (
    <div 
      className={`push-button ${isPressed ? 'pressed' : ''}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background: color
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => isPressed && handleMouseUp()}
    />
  );
}
```

**Update**: `src/components/primitives/PushButton.css`
```css
.push-button {
  border-radius: 50%;
  border: 4px solid #2a2a2a;
  cursor: pointer;
  transition: all 0.1s ease;
  box-shadow: 
    0 4px 8px rgba(0, 0, 0, 0.5),
    inset 0 2px 4px rgba(255, 255, 255, 0.2),
    inset 0 -2px 4px rgba(0, 0, 0, 0.3);
  user-select: none;
}

.push-button:hover {
  box-shadow: 
    0 4px 8px rgba(0, 0, 0, 0.5),
    inset 0 2px 4px rgba(255, 255, 255, 0.3),
    inset 0 -2px 4px rgba(0, 0, 0, 0.3),
    0 0 12px rgba(193, 74, 74, 0.4);
}

.push-button.pressed {
  transform: translateY(2px);
  box-shadow: 
    0 2px 4px rgba(0, 0, 0, 0.5),
    inset 0 3px 6px rgba(0, 0, 0, 0.4);
}
```

**Update**: `src/App.jsx`
```jsx
function App() {
  return (
    <div className="app">
      <div className="test-container">
        <h1>Interactive Button Test</h1>
        <p style={{color: '#888', marginBottom: '20px'}}>
          Open console and click the button
        </p>
        <PushButton 
          onPress={() => console.log('Button DOWN')}
          onRelease={() => console.log('Button UP')}
        />
      </div>
    </div>
  );
}
```

**Checkpoint**: Press button and verify console logs appear. Button should feel responsive.

---

### Step 3.3: Button Size Variations
**Goal**: Test different button sizes

**Update**: `src/App.jsx`
```jsx
function App() {
  return (
    <div className="app">
      <div className="test-container">
        <h1>Button Size Variations</h1>
        <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
          <div>
            <p style={{color: '#888', marginBottom: '10px'}}>Small (40px)</p>
            <PushButton size={40} />
          </div>
          <div>
            <p style={{color: '#888', marginBottom: '10px'}}>Medium (60px)</p>
            <PushButton size={60} />
          </div>
          <div>
            <p style={{color: '#888', marginBottom: '10px'}}>Large (80px)</p>
            <PushButton size={80} />
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Checkpoint**: Find the button size that matches the Minivac proportions.

---

### Step 3.4: Button with Ports
**Goal**: Combine button with port pairs (like binary input unit)

**File**: `src/components/modules/BinaryInputUnit.jsx`
```jsx
import PushButton from '../primitives/PushButton';
import Hole from '../primitives/Hole';
import './BinaryInputUnit.css';

export default function BinaryInputUnit({ 
  buttonSize = 60,
  holeSize = 10 
}) {
  return (
    <div className="binary-input-unit">
      <div className="input-ports-top">
        <Hole size={holeSize} />
        <Hole size={holeSize} />
        <Hole size={holeSize} />
      </div>
      <div className="input-ports-top">
        <Hole size={holeSize} />
        <Hole size={holeSize} />
        <Hole size={holeSize} />
      </div>
      <PushButton size={buttonSize} />
    </div>
  );
}
```

**File**: `src/components/modules/BinaryInputUnit.css`
```css
.binary-input-unit {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.input-ports-top {
  display: flex;
  gap: 10px;
}
```

**Update**: `src/App.jsx`
```jsx
import BinaryInputUnit from './components/modules/BinaryInputUnit';

function App() {
  return (
    <div className="app">
      <div className="test-container">
        <h1>Binary Input Unit</h1>
        <BinaryInputUnit />
      </div>
    </div>
  );
}
```

**Checkpoint**: Verify the complete binary input unit looks right. Adjust spacing if needed.

---

## Summary of Phases

✅ **Phase 1**: Single Hole component with proper styling  
✅ **Phase 2**: Combining holes into port pairs with labels  
✅ **Phase 3**: Interactive push button and combined module

**After each checkpoint**, stop and verify visually before moving to the next step. Make styling adjustments as needed.

**Next phases** (to be done after satisfaction with above):
- Phase 4: LED component
- Phase 5: Relay module
- Phase 6: Decimal wheel
- Phase 7: Section layout
- Phase 8: Full panel assembly
- Phase 9: State management
- Phase 10: Wiring system