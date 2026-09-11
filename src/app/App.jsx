import React, { useState, Suspense, useEffect } from "react";
import * as THREE from "three";
import { Leva } from "leva";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import Terrain from "../features/terrain/Terrain";
import ErosionSim from "../features/erosion/ErosionSim";
import InterfaceOverlay from "../components/InterfaceOverlay";
import "./App.css";

export default function App() {
  const [started, setStarted] = useState(false); // Start flag to control the display of the interface overlay and Leva panel
  const [appMode, setAppMode] = useState("GENERATE"); // App mode state to control the current mode of the application [Generate, Erode]
  const [terrainData, setTerrainData] = useState(null); // State to hold the terrain data generated from the Terrain component

  // Global loading states for the Web Workers
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");

  // State for detecting if the user is on a small screen / mobile device
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const backgroundColor = "#171513";

  // Callback function to handle baking the terrain data from the Terrain component
  const handleBakeTerrain = (heightmapArray) => {
    setTerrainData(heightmapArray);
    setAppMode("ERODE");
  };

  // Effect to handle leva panel collapse on mobile devices
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    // Hook into the global loader manager, deferring state updates to the next tick
    // to avoid React's "Cannot update component during render" warnings.
    THREE.DefaultLoadingManager.onStart = () => {
      setTimeout(() => {
        setIsLoading(true);
        setLoadingText(`Downloading Textures... 0%`);
      }, 0);
    };

    THREE.DefaultLoadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
      setTimeout(() => {
        setLoadingText(
          `Downloading Textures... ${Math.round((itemsLoaded / itemsTotal) * 100)}%`,
        );
      }, 0);
    };

    THREE.DefaultLoadingManager.onLoad = () => {
      setTimeout(() => {
        setIsLoading(false);
      }, 0);
    };

    THREE.DefaultLoadingManager.onError = () => {
      setTimeout(() => {
        setIsLoading(false);
      }, 0);
    };

    // Cleanup on unmount
    return () => {
      THREE.DefaultLoadingManager.onStart = null;
      THREE.DefaultLoadingManager.onProgress = null;
      THREE.DefaultLoadingManager.onLoad = null;
      THREE.DefaultLoadingManager.onError = null;
    };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      {/* Collapse Leva panel if user is on a mobile device */}
      <Leva collapsed={isMobile} />
      {/* Loading Overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <h3>{loadingText}</h3>
        </div>
      )}
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
        <Suspense fallback={null}>
          {appMode === "GENERATE" ? (
            <Terrain
              started={started}
              onBake={handleBakeTerrain}
              setIsLoading={setIsLoading}
              setLoadingText={setLoadingText}
            />
          ) : (
            <ErosionSim
              initialData={terrainData}
              onReturn={() => setAppMode("GENERATE")}
              setIsLoading={setIsLoading}
              setLoadingText={setLoadingText}
            />
          )}
        </Suspense>

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
