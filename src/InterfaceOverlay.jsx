import React from "react";
import { Leva } from "leva";

export default function InterfaceOverlay({ started, setStarted }) {
  return (
    <>
      {/* The global Leva panel, hidden until started */}
      <Leva hidden={!started} collapsed={true} flat={false} />

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
