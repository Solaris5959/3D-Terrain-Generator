import React, { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { extend, useFrame, useLoader } from "@react-three/fiber";
import { useControls, button } from "leva";
import { vertexShader, fragmentShader } from "../shared/shaders/TerrainShaders";
import { buildTerrainGeometry } from "../../lib/TerrainGeometry";
import { TERRAIN_SEGMENTS, TERRAIN_PALETTES } from "../../lib/Constants";

class TerrainMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      defines: {
        USE_RIDGED: false,
      },
      // Define uniforms for the GPU shader
      uniforms: {
        uSeed: { value: 69.0 },
        uScale: { value: 100.0 },
        uHeight: { value: 20.0 },
        uOctaves: { value: 9 },
        uPersistence: { value: 0.47 },
        // Biome uniforms
        uSnowLine: { value: 1.2 },
        uGrassLine: { value: -7.0 },
        uBlendSoftness: { value: 8.0 },
        // Color uniforms initialized with default palette
        uSnow: { value: null },
        uRock: { value: null },
        uGrass: { value: null },
        uTextureScale: { value: 10.0 },
        uGrassSlope: { value: 0.7 },
        uSnowSlope: { value: 0.65 },
        uSlopeSoftness: { value: 0.15 },
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

export default function Terrain({
  started,
  onBake,
  setIsLoading,
  setLoadingText,
}) {
  // Leva Controls for biome parameters
  const {
    Palette,
    SnowLine,
    GrassLine,
    BlendSoftness,
    GrassSlope,
    SnowSlope,
    SlopeSoftness,
    TextureScale,
  } = useControls("Biome Settings", {
    Palette: {
      options: TERRAIN_PALETTES,
      value: TERRAIN_PALETTES[0], // Ensure this maps to your folder names (e.g., "Basalt")
    },
    SnowLine: { value: 1.2, label: "Snow Line", min: -20.0, max: 40.0 },
    GrassLine: { value: -4.6, label: "Grass Line", min: -40.0, max: 40.0 },
    BlendSoftness: {
      value: 8.0,
      label: "Texture Blending Softness",
      min: 0.1,
      max: 10.0,
    },
    GrassSlope: {
      value: 0.7,
      label: "Grass Slope",
      min: 0.0,
      max: 1.0,
      step: 0.01,
    },
    SnowSlope: {
      value: 0.65,
      label: "Snow Slope",
      min: 0.0,
      max: 1.0,
      step: 0.01,
    },
    SlopeSoftness: {
      value: 0.15,
      label: "Slope Softness",
      min: 0.01,
      max: 0.5,
      step: 0.01,
    },
    TextureScale: { value: 10.0, label: "Texture Scale", min: 1.0, max: 50.0 },
  });

  const basePath = `${import.meta.env.BASE_URL}${Palette}/`;

  const textureUrls = useMemo(
    () => [
      `${basePath}GrassPacked.png`,
      `${basePath}SnowPacked.png`,
      `${basePath}RockPacked.png`,
      `${basePath}GrassNormal.png`,
      `${basePath}SnowNormal.png`,
      `${basePath}RockNormal.png`,
    ],
    [basePath],
  );

  const [grassTex, snowTex, rockTex, grassNorm, snowNorm, rockNorm] = useLoader(
    THREE.TextureLoader,
    textureUrls,
  );

  useMemo(() => {
    [grassTex, snowTex, rockTex].forEach((tex) => {
      // Wrap the color/roughness maps in sRGB
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
    });

    [grassNorm, snowNorm, rockNorm].forEach((tex) => {
      // Wrap the normal maps
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.needsUpdate = true;
    });
  }, [grassTex, snowTex, rockTex, grassNorm, snowNorm, rockNorm]);

  useEffect(() => {
    // Cleanup function to free GPU memory and clear R3F cache on unmount/theme change
    return () => {
      const textures = [
        grassTex,
        snowTex,
        rockTex,
        grassNorm,
        snowNorm,
        rockNorm,
      ];
      textures.forEach((tex, index) => {
        if (tex) {
          tex.dispose();
          useLoader.clear(THREE.TextureLoader, textureUrls[index]);
        }
      });
    };
  }, [textureUrls, grassTex, snowTex, rockTex, grassNorm, snowNorm, rockNorm]);

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
    InsaneMode: {
      value: false,
      hint: "Warning: Enabling this dramatically increases particle count and may impact performance.",
    },
    Model: { options: ["Smooth Perlin", "Ridged Perlin"] },
  });

  const useRidged = Model === "Ridged Perlin"; // Swap models if the Ridged Perlin option is selected

  // When the model switches, update the shader macro and force a recompile
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.defines.USE_RIDGED = useRidged;
      materialRef.current.needsUpdate = true;
    }
  }, [useRidged]);

  // Leva Controls for Terrain Parameters (Rebuilds limits if InsaneMode is toggled)
  const terrainParams = useControls(
    "Terrain Settings",
    {
      Segments: {
        options: Object.fromEntries(
          Object.entries(TERRAIN_SEGMENTS).filter(
            ([key, value]) => InsaneMode || value <= 512,
          ),
        ),
        value: TERRAIN_SEGMENTS["512"],
      },
      Seed: { value: 69, min: 0, max: 1000, step: 1, hint: "Random seed for terrain generation. Changing this will create a different terrain." },
      Scale: { value: 100.0, min: 1.0, max: InsaneMode ? 500.0 : 100.0, hint: "Controls the overall size of the terrain." },
      Height: { value: 30.0, min: 1.0, max: InsaneMode ? 500.0 : 100.0, hint: "Controls the overall height of the terrain." },
      Octaves: {
        value: 9,
        min: 1,
        max: InsaneMode ? 20 : 10,
        step: 1,
        hint: "Number of noise layers combined together. Higher values add finer details.",
      },
      Persistence: {
        value: 0.47,
        min: 0.1,
        max: InsaneMode ? 2.0 : 1.0,
        hint: "Controls how much each pass impacts the height of the terrain. Higher values create greater contrast.",
      },
    },
    [InsaneMode],
  );

  // UseMemo prevents the geometry from rebuilding every frame, object is the geometry of the terrain mesh/bounding box
  const geometry = useMemo(
    () => buildTerrainGeometry(100, 1000, terrainParams.Segments || 512),
    [terrainParams.Segments],
  );

  // Pipeline for baking the terrain pre erosion simulation
  useControls("Pipeline", () => ({
    "Bake & Erode": button((get) => {
      // Show loading screen immediately
      setIsLoading(true);
      setLoadingText("Baking Terrain Data...");

      const liveParams = {
        // Gather terrain parameters for one-time terrain bake
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

      // Initialize Web Worker for building the terrain heightmap
      const worker = new Worker(
        new URL("./HeightmapWorker.js", import.meta.url),
        { type: "module" },
      );

      // Configuring worker, process to run upon result of Web Worker
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
        // Catch baking error on worker
        console.error("Worker error:", error);
        setIsLoading(false);
        worker.terminate();
      };

      // Send data to worker to begin
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
        uniforms-uGrassLine-value={GrassLine}
        uniforms-uBlendSoftness-value={BlendSoftness}
        uniforms-uGrass-value={grassTex}
        uniforms-uRock-value={rockTex}
        uniforms-uSnow-value={snowTex}
        uniforms-uTextureScale-value={TextureScale}
        uniforms-uGrassNormal-value={grassNorm}
        uniforms-uRockNormal-value={rockNorm}
        uniforms-uSnowNormal-value={snowNorm}
        uniforms-uGrassSlope-value={GrassSlope}
        uniforms-uSnowSlope-value={SnowSlope}
        uniforms-uSlopeSoftness-value={SlopeSoftness}
      />
    </mesh>
  );
}
