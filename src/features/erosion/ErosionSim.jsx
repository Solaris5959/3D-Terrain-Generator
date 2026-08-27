import React, { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { extend, useFrame, useLoader, useThree } from "@react-three/fiber";
import { useControls, button } from "leva";
import {
  bakedVertexShader,
  fragmentShader,
} from "../shared/shaders/TerrainShaders";
import { buildTerrainGeometry } from "../../lib/TerrainGeometry";
import { TERRAIN_PALETTES } from "../../lib/Constants";
import { exportTerrainToGLB } from "../../lib/TerrainExporter";

// Create a new material class for the baked shader
class BakedTerrainMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      uniforms: {
        // Biome uniforms
        uSnowLine: { value: 20.0 },
        uGrassLine: { value: 5.0 },
        uBlendSoftness: { value: 2.0 },
        // Color uniforms initialized with default palette
        uSnow: { value: null },
        uRock: { value: null },
        uGrass: { value: null },
        uTextureScale: { value: 10.0 },
        uGrassSlope: { value: 0.7 },
        uSnowSlope: { value: 0.55 },
        uSlopeSoftness: { value: 0.15 },
        // Normals for textures
        uGrassNormal: { value: null },
        uRockNormal: { value: null },
        uSnowNormal: { value: null },
        uNormalStrength: { value: 1.5 },
        // Light direction uniform for lighting calculations in the shader
        uLightDir: { value: new THREE.Vector3(1.0, 1.0, 0.5) },
      },
      vertexShader: bakedVertexShader,
      fragmentShader: fragmentShader,
      wireframe: false,
    });
  }
}
extend({ BakedTerrainMaterial });

export default function ErosionSim({
  initialData,
  onReturn,
  setIsLoading,
  setLoadingText,
}) {
  const { insaneMode, segments, heights, terrainSize } = initialData;

  const basePath = import.meta.env.BASE_URL;

  const [grassTex, snowTex, rockTex, grassNorm, snowNorm, rockNorm] = useLoader(
    THREE.TextureLoader,
    [
      `${basePath}2kGrassPacked.png`,
      `${basePath}2kSnowPacked.png`,
      `${basePath}2kRockPacked.png`,
      `${basePath}2kGrassNormal.png`,
      `${basePath}2kSnowNormal.png`,
      `${basePath}2kRockNormal.png`,
    ],
  );

  useMemo(() => {
    [grassTex, snowTex, rockTex].forEach((tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
    });

    [grassNorm, snowNorm, rockNorm].forEach((tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    });
  }, [grassTex, snowTex, rockTex, grassNorm, snowNorm, rockNorm]);

  const materialRef = useRef();
  const geometryRef = useRef();

  // Lighting direction vectors for the shader
  const currentLightDir = useMemo(() => new THREE.Vector3(), []);
  const baseLightDir = useMemo(
    () => new THREE.Vector3(1.0, 1.0, 0.5).normalize(),
    [],
  );

  // Update the light direction in the shader based on camera orientation
  useFrame(({ camera }) => {
    if (materialRef.current) {
      currentLightDir.copy(baseLightDir);
      currentLightDir.applyQuaternion(camera.quaternion);
      materialRef.current.uniforms.uLightDir.value.copy(currentLightDir);
    }
  });

  const { gl } = useThree();

  const handleExport = (includeTextures) => {
    if (!geometryRef.current) return;

    setIsLoading(true);
    setLoadingText("Baking Textures & Generating .glb...");

    exportTerrainToGLB(
      gl,                          // WebGL Renderer
      geometryRef.current,         // Your live mesh
      heights,                     // Raw height data
      segments,                    // Resolution
      terrainSize,                 // Size (100)
      includeTextures,             // Boolean flag
      () => setIsLoading(false),
      () => setIsLoading(false)
    );
  };

  // Duplicate of Biome settings Leva control panel from Terrain component
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
      value: TERRAIN_PALETTES["Vibrant"],
    },
    SnowLine: { value: 1.2, label: "Snow Line", min: -20.0, max: 40.0 },
    GrassLine: { value: -7.0, label: "Grass Line", min: -40.0, max: 40.0 },
    BlendSoftness: { value: 8.0, label: "Texture Blending Softness", min: 0.1, max: 10.0 },
    GrassSlope: { value: 0.7, label: "Grass Slope", min: 0.0, max: 1.0, step: 0.01 },
    SnowSlope: { value: 0.65, label: "Snow Slope", min: 0.0, max: 1.0, step: 0.01 },
    SlopeSoftness: { value: 0.15, label: "Slope Softness", min: 0.01, max: 0.5, step: 0.01 },
    TextureScale: { value: 10.0, label: "Texture Scale", min: 1.0, max: 50.0 },
  });

  // Convert hex strings to THREE.Color objects only when the dropdown changes
  const biomeColors = useMemo(() => {
    return {
      snow: new THREE.Color(Palette.snow),
      rock: new THREE.Color(Palette.rock),
      Grass: new THREE.Color(Palette.Grass),
    };
  }, [Palette]);

  // Leva controls for erosion parameters
  useControls(
    "Erosion Settings",
    () => ({
      InsaneMode: { value: insaneMode, label: "Insane Mode", disabled: true },
      DropsK: { label: "Drops (k)", value: 12, min: 1, max: insaneMode ? 500 : 50, step: 1 },
      ErosionRate: { value: 0.1, label: "Erosion Rate", min: 0.01, max: 1.0 },
      TalusAngle: { value: 0.8, label: "Talus Angle", min: 0.1, max: 3.0, step: 0.1 },
      ThermalIterations: { value: 10, label: "Thermal Iterations", min: 0, max: insaneMode ? 500 : 20, step: 1 },
      "Run Erosion": button((get) => {
        const liveDropCount = get("Erosion Settings.DropsK") * 1000;
        const liveErosionRate = get("Erosion Settings.ErosionRate");
        const liveTalus = get("Erosion Settings.TalusAngle");
        const liveThermalIters = get("Erosion Settings.ThermalIterations");
        runSimulation(liveDropCount, liveErosionRate, liveTalus, liveThermalIters);
      }),
      "Return to Generator": button(() => {
        onReturn();
      }),
    }),
    [insaneMode],
  );

  useControls(
    "Export", 
    () => ({
      IncludeTextures: { value: true, label: "Export Textures" },
      "Export Terrain": button((get) => {
        // Fetch the boolean using the new folder namespace
        const includeTex = get("Export.IncludeTextures");
        
        setTimeout(() => handleExport(includeTex), 50); 
      }),
    })
  );

  // Create an unmodified BoxGeometry once to use as a structural template
  const baseGeometry = useMemo(() => {
    const geo = buildTerrainGeometry(terrainSize, 1000, segments);

    const count = geo.attributes.position.count;
    const isWallArray = new Float32Array(count);
    const normals = geo.attributes.normal.array;

    for (let i = 0; i < count; i++) {
      isWallArray[i] = normals[i * 3 + 1] > 0.5 ? 0.0 : 1.0;
    }

    geo.setAttribute("aIsWall", new THREE.BufferAttribute(isWallArray, 1));
    return geo;
  }, [terrainSize, segments]);

  // Helper function: Now accepts the target geometry so we can use it before rendering
  const applyHeightsToTarget = (targetGeo, heightArray) => {
    const positions = targetGeo.attributes.position.array;
    const basePositions = baseGeometry.attributes.position.array;

    const resolution = segments + 1;
    const halfSize = terrainSize / 2.0;

    for (let i = 0; i < basePositions.length; i += 3) {
      const x = basePositions[i];
      const y = basePositions[i + 1];
      const z = basePositions[i + 2];

      if (y > 0) {
        const ix = Math.round(((x + halfSize) / terrainSize) * segments);
        const iz = Math.round(((z + halfSize) / terrainSize) * segments);

        const safeIx = Math.max(0, Math.min(segments, ix));
        const safeIz = Math.max(0, Math.min(segments, iz));

        const hIndex = safeIx + safeIz * resolution;
        positions[i + 1] = 500.0 + heightArray[hIndex];
      }
    }

    targetGeo.attributes.position.needsUpdate = true;
    targetGeo.computeVertexNormals();
  };

  // Generate the geometry WITH heights already applied so it never renders flat
  const geometry = useMemo(() => {
    const geo = baseGeometry.clone();
    applyHeightsToTarget(geo, heights);
    return geo;
  }, [baseGeometry, heights]); // Only recreates if the base generator heights change

  // Simulation function that fires up the web worker
  const runSimulation = (
    currentDropCount,
    currentErosionRate,
    talus,
    thermalIters,
  ) => {
    if (!geometryRef.current) return;

    setIsLoading(true);
    setLoadingText(
      `Simulating ${currentDropCount.toLocaleString()} raindrops...`,
    );

    const currentHeights = new Float32Array(heights);
    const worker = new Worker(new URL("./ErosionWorker.js", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (e) => {
      const { newHeights } = e.data;

      // Map the new heights back to our existing geometry reference for performance
      applyHeightsToTarget(geometryRef.current.geometry, newHeights);

      setIsLoading(false);
      worker.terminate();
    };

    worker.onerror = (error) => {
      console.error("Worker error:", error);
      setIsLoading(false);
      worker.terminate();
    };

    worker.postMessage({
      heights: currentHeights,
      segments,
      dropCount: currentDropCount,
      erosionRate: currentErosionRate,
      talus,
      thermalIters,
    });
  };

  // Effect to dismiss load screen once geometry is mounted
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 50);

    return () => clearTimeout(timer);
  }, [setIsLoading]);

  return (
    <mesh geometry={geometry} position={[0, -500, 0]} ref={geometryRef}>
      <bakedTerrainMaterial
        ref={materialRef}
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
