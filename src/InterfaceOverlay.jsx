import React from "react";
import { Leva } from "leva";

const theme = {
  colors: {
    elevation1: "#161614", // Panel background
    elevation2: "#21211E", // Input/Button background
    elevation3: "#2D2D29", // Hover state for inputs
    accent1: "#D9822B", // Primary accent (Burnt Amber)
    accent2: "#E69847", // Hover state for accent
    accent3: "#F2AF63", // Active/Click state for accent
    highlight1: "#6E6D66", // Muted text/labels
    highlight2: "#A8A7A0", // Regular text
    highlight3: "#E3E2DB", // Hover text
    vivid1: "#D94C4C", // Error/Warning red
  },
  radii: {
    xs: "2px",
    sm: "3px",
    lg: "10px",
  },
  space: {
    sm: "6px",
    md: "10px",
    rowGap: "7px",
    colGap: "7px",
  },
  fontSizes: {
    root: "11px",
  },
  sizes: {
    rootWidth: "280px",
    controlWidth: "160px",
    scrubberWidth: "8px",
    scrubberHeight: "16px",
    rowHeight: "24px",
    folderHeight: "20px",
    checkboxSize: "16px",
    joystickWidth: "100px",
    joystickHeight: "100px",
    colorPickerWidth: "160px",
    colorPickerHeight: "100px",
    monitorHeight: "60px",
    titleBarHeight: "39px",
  },
  borderWidths: {
    root: "0px",
    input: "1px",
    focus: "1px",
    hover: "1px",
    active: "1px",
    folder: "1px",
  },
  fontWeights: {
    label: "normal",
    folder: "normal",
    button: "normal",
  },
};

export default function InterfaceOverlay({ started, setStarted }) {
  return (
    <>
      {/* Leva panel for controlling terrain parameters */}
      <Leva
        theme={theme}
        hidden={!started}
        collapsed={false}
        flat={false}
        oneLineLabels={true}
        titleBar={{
          title: "3D Terrain Generator",
          drag: true,
          filter: false,
        }}
      />

      {/* The welcome modal overlay */}
      <div className={`overlay ${started ? "fade-out" : "fade-in"}`}>
        {!started && (
          <div className="popup-modal">
            <h1>Welcome</h1>
            <p>Customize and generate procedural terrain.</p>
            <button onClick={() => setStarted(true)}>START GENERATING</button>
          </div>
        )}
      </div>
    </>
  );
}
