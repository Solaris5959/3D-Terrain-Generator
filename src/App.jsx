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

        <ambientLight intensity={0.2} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={0.8}
          color="#aaaaaa"
        />

        <Terrain started={started} />

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          minDistance={10}
          maxDistance={130}
        />
      </Canvas>

      <InterfaceOverlay started={started} setStarted={setStarted} />
    </div>
  );
}
