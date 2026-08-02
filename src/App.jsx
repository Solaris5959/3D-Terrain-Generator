import React, { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import Terrain from "./Terrain";
import InterfaceOverlay from "./InterfaceOverlay";
import "./App.css";

export default function App() {
  const [started, setStarted] = useState(false); // Start flag to control the display of the interface overlay and Leva panel

  const backgroundColor = "#111111";

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      {/* Canvas component to render the 3D scene. Sets up camera, lighting, and includes the Terrain component. */}
      <Canvas
        camera={{ position: [0, 40, 80], fov: 60 }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 0,
        }}
      >
        <color attach="background" args={[backgroundColor]} />

        <Terrain started={started} />

        {/* Camera controls for rotating, zooming, and panning */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          minDistance={10}
          maxDistance={140}
        />
      </Canvas>

      {/* Interface overlay component for the welcome modal and Leva panel */}
      <InterfaceOverlay started={started} setStarted={setStarted} />
    </div>
  );
}
