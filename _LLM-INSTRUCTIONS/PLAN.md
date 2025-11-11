# Minivac 601 Web Implementation Specification

## Technology Stack
- **React** with hooks for state management
- **CSS** for styling and layout
- **SVG** for decorative/static graphics
- **HTML** for interactive elements

## Architecture Overview

The UI is built using a component hierarchy from basic primitives up to complete panel sections:

- **Primitives**: Individual interactive/visual elements (Hole, LED, Label)
- **Connectors**: Groups of primitives with shared functionality (PortPair, SlideSwitch)
- **Modules**: Complete functional units (DecimalWheel, RelayModule, StorageUnit)
- **Panels**: Top-level layout containers (MainPanel, SidePanel)

---

## Component Specifications

### PRIMITIVES

#### `Hole.jsx`
Single connection point for wiring.

**Props:**
```javascript
{
  id: string,              // Unique identifier "decimal-3-outer"
  position: {x, y},        // Absolute position in pixels
  size: number,            // Diameter in pixels (default: 10)
  connected: boolean,      // Visual state
  wireColor: string,       // Color when connected
  label: string,           // Optional label (e.g., "R", "S")
  onConnect: function      // Callback when clicked
}
```

**Implementation:**
- Render as `<div className="hole">` with absolute positioning
- Show different visual states: empty (dark), connected (colored)
- Emit connection events on click
- Display small label if provided (positioned nearby)

#### `LED.jsx`
Light indicator.

**Props:**
```javascript
{
  id: string,
  size: number,            // Diameter (default: 40)
  lit: boolean,            // On/off state
  color: string            // "red" when lit
}
```

**Implementation:**
- Circular div with gradient/shadow effects
- Dark when off, glowing when lit
- CSS transitions for state changes

#### `Label.jsx`
Text label for components.

**Props:**
```javascript
{
  text: string,
  position: "top" | "bottom" | "left" | "right",
  fontSize: number
}
```

---

### CONNECTORS

#### `PortPair.jsx`
Two or more holes with a shared label.

**Props:**
```javascript
{
  label: string,           // "ARM", "COIL", "N.O."
  holes: [
    {id: string, sublabel: string},  // sublabel like "R", "S", "T"
    ...
  ],
  orientation: "horizontal" | "vertical",
  spacing: number          // Gap between holes
}
```

**Implementation:**
```jsx
<div className="port-pair">
  <Label text={label} position="top" />
  <div className="holes-container">
    {holes.map(hole => (
      <div key={hole.id}>
        {hole.sublabel && <span className="sublabel">{hole.sublabel}</span>}
        <Hole id={hole.id} />
      </div>
    ))}
  </div>
</div>
```

**Example usage:**
```jsx
<PortPair 
  label="ARM"
  holes={[
    {id: "arm-r", sublabel: "R"},
    {id: "arm-s", sublabel: "S"},
    {id: "arm-t", sublabel: "T"}
  ]}
  orientation="horizontal"
/>
```

#### `PortGrid.jsx`
NxM grid of holes (for matrix sections).

**Props:**
```javascript
{
  rows: number,
  cols: number,
  holes: [{id, row, col}],
  spacing: number
}
```

#### `SlideSwitch.jsx`
Switch component with ports on sides.

**Props:**
```javascript
{
  id: string,
  leftPorts: [{id, label}],   // Holes on left side
  rightPorts: [{id, label}],  // Holes on right side
  topLabel: string,           // e.g., "ARM"
  switchWidth: number,
  switchHeight: number
}
```

**Implementation:**
```jsx
<div className="slide-switch">
  <Label text={topLabel} position="top" />
  
  <div className="switch-body">
    <div className="left-ports">
      {leftPorts.map(port => <Hole key={port.id} label={port.label} />)}
    </div>
    
    <div className="switch-element">
      {/* Visual switch bar/slider */}
    </div>
    
    <div className="right-ports">
      {rightPorts.map(port => <Hole key={port.id} label={port.label} />)}
    </div>
  </div>
</div>
```

---

### MODULES

#### `DecimalWheel.jsx`
Complete rotary selector with numbered positions.

**Props:**
```javascript
{
  id: string,
  diameter: number,        // Outer diameter (default: 220)
  currentValue: number,    // 0-15
  onValueChange: function,
  externalPorts: [        // Ports outside the wheel (16-19)
    {id, number, label}
  ]
}
```

**Structure:**
The wheel uses a **layered approach**:

1. **SVG Background Layer** (static decoration):
```jsx
<svg className="wheel-svg" viewBox="0 0 240 240">
  {/* Outer circle */}
  <circle cx="120" cy="120" r="110" fill="none" stroke="#ccc" />
  
  {/* Segment divider lines */}
  {Array.from({length: 16}).map((_, i) => {
    const angle = (360 / 16) * i - 90;
    const rad = angle * Math.PI / 180;
    return (
      <line 
        key={i}
        x1={120 + 50 * Math.cos(rad)}
        y1={120 + 50 * Math.sin(rad)}
        x2={120 + 110 * Math.cos(rad)}
        y2={120 + 110 * Math.sin(rad)}
        stroke="#ccc"
      />
    );
  })}
  
  {/* Number labels */}
  {Array.from({length: 16}).map((_, i) => {
    const angle = (360 / 16) * i - 90;
    const rad = angle * Math.PI / 180;
    const x = 120 + 80 * Math.cos(rad);
    const y = 120 + 80 * Math.sin(rad);
    return (
      <text key={i} x={x} y={y} textAnchor="middle">{i}</text>
    );
  })}
</svg>
```

2. **Interactive Holes Layer** (HTML for better interaction):
```jsx
<div className="wheel-holes">
  {wheelHoles.map((hole, i) => {
    const angle = (360 / 16) * i - 90;
    const rad = angle * Math.PI / 180;
    const x = 120 + 95 * Math.cos(rad);  // Position on outer ring
    const y = 120 + 95 * Math.sin(rad);
    
    return (
      <Hole 
        key={hole.id}
        id={hole.id}
        position={{x, y}}
        size={8}
      />
    );
  })}
</div>
```

3. **Rotatable Pointer** (center knob):
```jsx
<div 
  className="wheel-knob" 
  style={{transform: `rotate(${currentValue * 22.5}deg)`}}
>
  <div className="knob-body" />
  <div className="pointer-triangle" />
</div>
```

4. **External Ports** (positioned outside wheel):
```jsx
<div className="external-ports">
  <PortPair label="16" holes={[{id: "port-16-arm"}]} />
  <PortPair label="17" holes={[{id: "port-17-run"}]} />
  <PortPair label="18" holes={[{id: "port-18-stop"}]} />
  <PortPair label="19" holes={[{id: "port-19"}]} />
</div>
```

**Helper function for polar coordinates:**
```javascript
const getWheelHolePosition = (index, total, radius, centerX, centerY) => {
  const angle = (360 / total) * index - 90; // -90 to start at top
  const rad = angle * Math.PI / 180;
  return {
    x: centerX + radius * Math.cos(rad),
    y: centerY + radius * Math.sin(rad)
  };
};
```

#### `RelayModule.jsx`
Storage/processing unit with relay box, button, and ports.

**Props:**
```javascript
{
  id: string,
  topPorts: {
    light: [{id}],         // 2 holes for LIGHT
    coil: [{id}]           // 2 holes for COIL
  },
  bottomPorts: {
    no: [{id}],            // Normally Open
    arm: [{id}],           // Armature
    nc: [{id}]             // Normally Closed
  },
  relayState: boolean      // Energized or not
}
```

**Implementation:**
```jsx
<div className="relay-module">
  <div className="top-ports">
    <PortPair label="LIGHT" holes={topPorts.light} />
    <PortPair label="COIL" holes={topPorts.coil} />
  </div>
  
  <div className="relay-box">
    {/* Cream colored rectangle */}
  </div>
  
  <div className="relay-button">
    {/* Red circular button */}
  </div>
  
  <div className="bottom-ports">
    <PortPair label="N.O." holes={bottomPorts.no} />
    <PortPair label="ARM" holes={bottomPorts.arm} />
    <PortPair label="N.C." holes={bottomPorts.nc} />
  </div>
</div>
```

#### `BinaryOutputUnit.jsx`
Single binary output with LED and ports.

**Props:**
```javascript
{
  number: number,          // 1-6
  ledState: boolean,
  portId: string
}
```

**Implementation:**
```jsx
<div className="binary-output-unit">
  <Label text={number} position="top" />
  <LED lit={ledState} size={50} />
  <Hole id={portId} />
</div>
```

#### `BinaryInputUnit.jsx`
Single binary input with button and ports.

**Props:**
```javascript
{
  id: string,
  topPorts: [{id}, {id}],
  onPress: function
}
```

**Implementation:**
```jsx
<div className="binary-input-unit">
  <div className="top-ports">
    {topPorts.map(port => <Hole key={port.id} id={port.id} />)}
  </div>
  <button className="input-button" onClick={onPress}>
    {/* Large red circular button */}
  </button>
</div>
```

#### `SecondaryStorageUnit.jsx`
Capacitor storage with ports.

**Props:**
```javascript
{
  id: string,
  topPorts: [{id}, {id}, {id}],
  capacitorState: boolean
}
```

**Implementation:**
```jsx
<div className="secondary-storage-unit">
  <div className="top-ports">
    {topPorts.map((port, i) => <Hole key={i} id={port.id} />)}
  </div>
  <div className="capacitor-indicator">
    {/* Circle or bar showing charge state */}
  </div>
</div>
```

---

### PANELS

#### `MainPanel.jsx`
Left panel containing primary sections.

**Structure:**
```jsx
<div className="main-panel">
  <div className="title-bar">
    <h1>Minivac 601</h1>
  </div>
  
  <section className="binary-output-section">
    <h2>BINARY OUTPUT</h2>
    <div className="output-grid">
      {[1,2,3,4,5,6].map(n => (
        <BinaryOutputUnit key={n} number={n} />
      ))}
    </div>
  </section>
  
  <div className="section-divider" />
  
  <section className="storage-processing-section">
    <h2>STORAGE/PROCESSING</h2>
    <div className="relay-grid">
      {[1,2,3,4,5,6].map(n => (
        <RelayModule key={n} id={`relay-${n}`} />
      ))}
    </div>
  </section>
  
  <div className="section-divider" />
  
  <section className="secondary-storage-section">
    <h2>SECONDARY STORAGE</h2>
    <div className="storage-grid">
      {[1,2,3,4,5,6].map(n => (
        <SecondaryStorageUnit key={n} id={`storage-${n}`} />
      ))}
    </div>
  </section>
  
  <div className="section-divider" />
  
  <section className="binary-input-section">
    <h2>BINARY INPUT</h2>
    <div className="input-grid">
      {[1,2,3,4,5,6].map(n => (
        <BinaryInputUnit key={n} id={`input-${n}`} />
      ))}
    </div>
  </section>
</div>
```

#### `SidePanel.jsx`
Right panel with power and decimal sections.

**Structure:**
```jsx
<div className="side-panel">
  <section className="power-section">
    <h2>POWER</h2>
    <LED lit={powerOn} size={40} />
    <div className="matrix-subsection">
      <h3>MATRIX</h3>
      <PortGrid rows={4} cols={4} />
    </div>
  </section>
  
  <section className="decimal-section">
    <h2>DECIMAL INPUT:OUTPUT</h2>
    <DecimalWheel 
      currentValue={decimalValue}
      onValueChange={setDecimalValue}
    />
  </section>
</div>
```

---

## State Management

### Global State Structure
Use React Context or Redux for app-wide state:

```javascript
const MinivacState = {
  // Connection tracking
  connections: [
    {
      id: "conn-1",
      from: "hole-decimal-3",
      to: "hole-binary-input-2",
      wireColor: "red"
    }
  ],
  
  // Hole states (derived from connections)
  holes: {
    "hole-decimal-3": {
      connected: true,
      wireColor: "red",
      connectedTo: "hole-binary-input-2"
    }
  },
  
  // Component states
  power: {
    on: true
  },
  
  binaryOutputs: {
    1: {lit: false},
    2: {lit: true},
    // ...
  },
  
  relays: {
    1: {energized: false},
    // ...
  },
  
  decimalWheel: {
    value: 0  // 0-15
  },
  
  // User interaction mode
  wireMode: {
    active: false,
    selectedHole: null,
    currentColor: "red"
  }
}
```

### Connection Logic

```javascript
// When user clicks a hole
const handleHoleClick = (holeId) => {
  if (!wireMode.active) {
    // Start new connection
    setWireMode({
      active: true,
      selectedHole: holeId,
      currentColor: selectedWireColor
    });
  } else {
    // Complete connection
    if (holeId !== wireMode.selectedHole) {
      addConnection({
        from: wireMode.selectedHole,
        to: holeId,
        wireColor: wireMode.currentColor
      });
    }
    // Reset wire mode
    setWireMode({active: false, selectedHole: null});
  }
};
```

---

## Styling Guidelines

### Layout
- **Fixed widths**: Main panel 1040px, Side panel 300px
- **No responsive breakpoints**: Desktop only
- **Section dividers**: 8px tall blue bars (#2874A6)

### Colors
```css
:root {
  --bg-dark: #3a4a52;
  --bg-medium: #4a5a62;
  --bg-section: #3a4a52;
  --border-blue: #2874A6;
  --text-light: #d0d0d0;
  --led-red: #c14a4a;
  --relay-cream: #e8e8e8;
  --hole-empty: #2a2a2a;
  --hole-border: #5a5a5a;
}
```

### Typography
```css
body {
  font-family: 'Courier New', monospace;
}

.section-title {
  font-size: 11px;
  font-weight: bold;
  letter-spacing: 3px;
  color: var(--text-light);
}

.panel-title {
  font-size: 24px;
  letter-spacing: 2px;
}
```

### Interactive Elements
```css
.hole {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--hole-empty);
  border: 2px solid var(--hole-border);
  cursor: pointer;
  transition: all 0.2s;
}

.hole.connected {
  background: var(--wire-color);
  box-shadow: 0 0 8px var(--wire-color);
}

.hole:hover {
  transform: scale(1.2);
}
```

---

## File Structure

```
src/
├── App.jsx
├── context/
│   └── MinivacContext.jsx
├── components/
│   ├── primitives/
│   │   ├── Hole.jsx
│   │   ├── LED.jsx
│   │   └── Label.jsx
│   ├── connectors/
│   │   ├── PortPair.jsx
│   │   ├── PortGrid.jsx
│   │   └── SlideSwitch.jsx
│   ├── modules/
│   │   ├── DecimalWheel.jsx
│   │   ├── RelayModule.jsx
│   │   ├── BinaryOutputUnit.jsx
│   │   ├── BinaryInputUnit.jsx
│   │   └── SecondaryStorageUnit.jsx
│   └── panels/
│       ├── MainPanel.jsx
│       └── SidePanel.jsx
├── utils/
│   ├── coordinates.js      // Polar coordinate helpers
│   └── connections.js      // Connection validation
└── styles/
    ├── global.css
    ├── primitives.css
    ├── connectors.css
    ├── modules.css
    └── panels.css
```

---

## Implementation Notes

1. **SVG vs HTML decision**:
   - Use SVG for static decoration (lines, labels, backgrounds)
   - Use HTML divs for interactive elements (holes, buttons)
   - Reason: Better click targets, easier state styling, simpler event handling

2. **Absolute positioning**:
   - Wheel holes use calculated polar coordinates
   - All other components use flexbox/grid where possible
   - Absolute only when geometrically necessary

3. **Component reusability**:
   - `Hole` is maximally reusable (used everywhere)
   - `PortPair` handles most labeling patterns
   - Each module is self-contained with its own layout logic

4. **Performance considerations**:
   - Memoize expensive calculations (polar coordinates)
   - Use React.memo for Hole components (rendered many times)
   - Optimize re-renders with proper state structure

5. **Accessibility**:
   - Add aria-labels to interactive holes
   - Keyboard navigation for wiring mode
   - Focus indicators on selected holes