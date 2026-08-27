import React, { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { extend, useFrame, useLoader } from "@react-three/fiber";
import { useControls, button } from "leva";
import { vertexShader, fragmentShader } from "../shared/shaders/TerrainShaders";
import { TERRAIN_SEGMENTS, TERRAIN_PALETTES } from "../../lib/Constants";

class TerrainMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      defines: {
        USE_RIDGED: false,
      },
      // Define uniforms for the GPU shader
      uniforms: {
        uSeed: { value: 629.0 },
        uScale: { value: 34.5 },
        uHeight: { value: 28.5 },
        uOctaves: { value: 7 },
        uPersistence: { value: 0.45 },
        // Biome uniforms
        uSnowLine: { value: 20.0 },
        uTreeLine: { value: 5.0 },
        uBlendSoftness: { value: 2.0 },
        // Color uniforms initialized with default palette
        uSnow: { value: null },
        uRock: { value: null },
        uGrass: { value: null },
        uTextureScale: { value: 10.0 },
        // Normals for textures
        uGrassNormal: { value: null },
        uRockNormal: { value: null },
        uSnowNormal: { value: null },
        uNormalStrength: { value: 1.5 },
        // Light direction uniform for lighting calculations in the shader
        uLightDir: { value: new THREE.Vector3(1.0, 1.0, 0.5) },
      },
      vertexShader,
      fragmentShader,
      wireframe: false,
    });
  }
}

extend({ TerrainMaterial });

export default function Terrain({ started, onBake, setIsLoading, setLoadingText }) {
  const basePath = import.meta.env.BASE_URL;

  const [grassTex, snowTex, rockTex, grassNorm, snowNorm, rockNorm ] = useLoader(THREE.TextureLoader, [
    `${basePath}2kGrassPacked.png`, 
    `${basePath}2kSnowPacked.png`,
    `${basePath}2kRockPacked.png`,
    `${basePath}2kGrassNormal.png`,
    `${basePath}2kSnowNormal.png`,
    `${basePath}2kRockNormal.png`
  ]);

  useMemo(() => {
    [grassTex, snowTex, rockTex].forEach(tex => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
    });

    [grassNorm, snowNorm, rockNorm].forEach(tex => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    });
  }, [grassTex, snowTex, rockTex, grassNorm, snowNorm, rockNorm]);

  // Reference to the terrainMaterial element
  const materialRef = useRef();

  // Instantiate a static vector, holds final light direction
  const currentLightDir = useMemo(() => new THREE.Vector3(), []);

  // Instantiate a static vector, holds the base light direction (top-right-front) for the shader
  const baseLightDir = useMemo(
    () => new THREE.Vector3(1.0, 1.0, 0.5).normalize(),
    [],
  );

  // Pass the camera direction to the shader on every frame to update lighting based on camera orientation
  useFrame(({ camera }) => {
    if (materialRef.current) {
      // Reset the current light direction to the base light direction
      currentLightDir.copy(baseLightDir);

      // Apply camera's rotation to the light direction, so the light appears to come from the same direction relative to the camera
      currentLightDir.applyQuaternion(camera.quaternion);

      // Send the updated light direction to the shader uniform for lighting calculations
      materialRef.current.uniforms.uLightDir.value.copy(currentLightDir);
    }
  });

  // Global Settings Controls
  const { InsaneMode, Model } = useControls("Settings", {
    InsaneMode: false,
    Model: { options: ["Smooth Perlin", "Ridged Perlin"] },
  });

  const useRidged = Model === "Ridged Perlin";

  // When the model switches, update the shader macro and force a recompile
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.defines.USE_RIDGED = useRidged;
      materialRef.current.needsUpdate = true;
    }
  }, [useRidged]);

  // Terrain Parameters (Rebuilds limits if InsaneMode is toggled)
  const terrainParams = useControls(
    "Terrain Settings",
    {
      Segments: {
        options: Object.fromEntries(
          Object.entries(TERRAIN_SEGMENTS).filter(
            ([key, value]) => InsaneMode || value <= 512
          )
        ),
        value: TERRAIN_SEGMENTS['512']
      },
      Seed: { value: 629, min: 0, max: 1000, step: 1 },
      Scale: { value: 34.5, min: 1.0, max: InsaneMode ? 500.0 : 100.0 },
      Height: { value: 28.5, min: 1.0, max: InsaneMode ? 500.0 : 100.0 },
      Octaves: { value: 7, min: 1, max: InsaneMode ? 16 : 8, step: 1 },
      Persistence: { value: 0.45, min: 0.1, max: InsaneMode ? 2.0 : 1.0 },
    },
    [InsaneMode], // Dependency array ensures Leva rebuilds max boundaries
  );

  // UseMemo prevents the geometry from rebuilding every frame, object is the geometry of the terrain mesh/bounding box
  const geometry = useMemo(
    () =>
      new THREE.BoxGeometry(
        100,
        1000,
        100,
        terrainParams.Segments || 512, // fallback if hidden
        1,
        terrainParams.Segments || 512,
      ),
    [terrainParams.Segments],
  );

  // Leva Controls for biome parameters
  const { Palette, SnowLine, TreeLine, BlendSoftness, TextureScale } = useControls(
    "Biome Settings",
    {
      Palette: {
        options: TERRAIN_PALETTES,
        value: TERRAIN_PALETTES["Vibrant"],
      },
      SnowLine: { value: 10.0, min: -20.0, max: 40.0 },
      TreeLine: { value: -11.0, min: -40.0, max: 40.0 },
      BlendSoftness: { value: 8.0, min: 0.1, max: 10.0 },
      TextureScale: { value: 10.0, min: 1.0, max: 50.0 },
    },
  );

  // Convert hex strings to THREE.Color objects only when the dropdown changes
  const biomeColors = useMemo(() => {
    return {
      snow: new THREE.Color(Palette.snow),
      rock: new THREE.Color(Palette.rock),
      tree: new THREE.Color(Palette.tree),
    };
  }, [Palette]);

  useControls("Pipeline", () => ({
    "Bake & Erode": button((get) => {
      // 1. Show loading screen immediately
      setIsLoading(true);
      setLoadingText("Baking Terrain Data...");

      const liveParams = {
        Seed: get("Terrain Settings.Seed"),
        Scale: get("Terrain Settings.Scale"),
        Height: get("Terrain Settings.Height"),
        Octaves: get("Terrain Settings.Octaves"),
        Persistence: get("Terrain Settings.Persistence"),
        Model: get("Settings.Model"),
      };

      const numSegments = get("Terrain Settings.Segments") || 512;
      const terrainSize = 100;
      const insaneFlag = get("Settings.InsaneMode");

      // 2. Initialize the Web Worker (type: 'module' handles imports inside the worker)
      const worker = new Worker(new URL('./HeightmapWorker.js', import.meta.url), { type: 'module' });

      // 3. Listen for the result
      worker.onmessage = (e) => {
        const { heightMap } = e.data;
        
        onBake({
          insaneMode: insaneFlag,
          segments: numSegments,
          heights: heightMap,
          terrainSize: terrainSize,
        });

        worker.terminate(); // Clean up worker
      };

      worker.onerror = (error) => {
        console.error("Worker error:", error);
        setIsLoading(false);
        worker.terminate();
      };

      // 4. Send data to worker to begin
      worker.postMessage({ numSegments, terrainSize, liveParams });
    }),
  }));

  // Return the mesh with the custom shader material applied, passing in the uniforms for the shader
  return (
    <mesh geometry={geometry} position={[0, -500, 0]}>
      <terrainMaterial
        ref={materialRef}
        uniforms-uSeed-value={terrainParams.Seed}
        uniforms-uScale-value={terrainParams.Scale}
        uniforms-uHeight-value={terrainParams.Height}
        uniforms-uOctaves-value={terrainParams.Octaves}
        uniforms-uPersistence-value={terrainParams.Persistence}
        uniforms-uSnowLine-value={SnowLine}
        uniforms-uTreeLine-value={TreeLine}
        uniforms-uBlendSoftness-value={BlendSoftness}
        uniforms-uGrass-value={grassTex}
        uniforms-uRock-value={rockTex}
        uniforms-uSnow-value={snowTex}
        uniforms-uTextureScale-value={TextureScale}
        uniforms-uGrassNormal-value={grassNorm}
        uniforms-uRockNormal-value={rockNorm}
        uniforms-uSnowNormal-value={snowNorm}
      />
    </mesh>
  );
}
