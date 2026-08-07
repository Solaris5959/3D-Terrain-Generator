import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { extend, useFrame } from "@react-three/fiber";
import { useControls, button } from "leva";
import { vertexShader, fragmentShader } from "../shared/shaders/TerrainShaders";
import { generateCPUHeightmap } from "../../lib/noise/NoiseUtils";
import { TERRAIN_PALETTES, TERRAIN_SEGMENTS } from "../../lib/Constants";

class TerrainMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
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
        uSnowColor: { value: new THREE.Color("#FFFFFF") },
        uRockColor: { value: new THREE.Color("#8A7D72") },
        uTreeColor: { value: new THREE.Color("#407239") },
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

export default function Terrain({ started, onBake }) {
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

  // UseMemo prevents the geometry from rebuilding every frame, object is the geometry of the terrain mesh/bounding box
  const geometry = useMemo(
    () =>
      new THREE.BoxGeometry(
        100,
        1000,
        100,
        TERRAIN_SEGMENTS,
        1,
        TERRAIN_SEGMENTS,
      ),
    [],
  );

  // Leva Controls for terrain parameters
  const terrainParams = useControls("Terrain Settings", {
    Seed: { value: 629, min: 0, max: 1000, step: 1 },
    Scale: { value: 34.5, min: 1.0, max: 50.0 },
    Height: { value: 28.5, min: 1.0, max: 50.0 },
    Octaves: { value: 7, min: 1, max: 8, step: 1 },
    Persistence: { value: 0.45, min: 0.1, max: 1.0 },
  });

  // Leva Controls for biome parameters
  const { Palette, SnowLine, TreeLine, BlendSoftness } = useControls(
    "Biome Settings",
    {
      Palette: {
        options: TERRAIN_PALETTES,
        value: TERRAIN_PALETTES["Vibrant"],
      },
      SnowLine: { value: 10.0, min: -20.0, max: 40.0 },
      TreeLine: { value: -11.0, min: -40.0, max: 40.0 },
      BlendSoftness: { value: 8.0, min: 0.1, max: 10.0 },
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
      // Fetch the absolute latest values directly from the UI store
      const liveParams = {
        Seed: get("Terrain Settings.Seed"),
        Scale: get("Terrain Settings.Scale"),
        Height: get("Terrain Settings.Height"),
        Octaves: get("Terrain Settings.Octaves"),
        Persistence: get("Terrain Settings.Persistence"),
      };

      const segments = TERRAIN_SEGMENTS;
      const terrainSize = 100;

      // Pass the liveParams to your CPU generator
      const heightmap = generateCPUHeightmap(segments, terrainSize, liveParams);

      onBake({
        heights: heightmap,
        terrainSize: terrainSize,
      });
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
        uniforms-uSnowColor-value={biomeColors.snow}
        uniforms-uRockColor-value={biomeColors.rock}
        uniforms-uTreeColor-value={biomeColors.tree}
      />
    </mesh>
  );
}
