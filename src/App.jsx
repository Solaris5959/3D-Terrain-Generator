import React, { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import Terrain from "./Terrain";
import ErosionSim from "./ErosionSim";
import InterfaceOverlay from "./InterfaceOverlay";
import "./App.css";

export default function App() {
  const [started, setStarted] = useState(false); // Start flag to control the display of the interface overlay and Leva panel
  const [appMode, setAppMode] = useState("GENERATE"); // App mode state to control the current mode of the application [Generate, Erode]
  const [terrainData, setTerrainData] = useState(null); // State to hold the terrain data generated from the Terrain component

  const backgroundColor = "#111111";

  // Callback function to handle baking the terrain data from the Terrain component
  const handleBakeTerrain = (heightmapArray) => {
    setTerrainData(heightmapArray);
    setAppMode("ERODE");
  };

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

        {/* Swap components based on the current mode, keeps GPU data in scope */}
        {appMode === "GENERATE" ? (
          <Terrain started={started} onBake={handleBakeTerrain} />
        ) : (
          <ErosionSim 
            initialData={terrainData} 
            onReturn={() => setAppMode("GENERATE")} 
          />
        )}

        {/* Camera controls for rotating, zooming, and panning */}
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={10}
          maxDistance={140}
          maxPolarAngle={Math.PI / 2 - 0.05}
        />
      </Canvas>

      {/* Interface overlay component for the welcome modal and Leva panel */}
      <InterfaceOverlay started={started} setStarted={setStarted} />
    </div>
  );
}
