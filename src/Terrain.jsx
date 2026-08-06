import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { extend, useFrame } from "@react-three/fiber";
import { useControls } from "leva";
import { vertexShader, fragmentShader } from "./Shaders/TerrainShaders";


const TERRAIN_PALETTES = {
  "Vibrant": { snow: "#FFFFFF", rock: "#8A7D72", tree: "#407239" },
  "Alpine": { snow: "#F2F5F8", rock: "#898c90", tree: "#3a5a49" },
  "Tundra": { snow: "#DDE5ED", rock: "#687686", tree: "#103a27" },
};

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

export default function Terrain() {
  // Reference to the terrainMaterial element
  const materialRef = useRef();

  // Instantiate a static vector, holds final light direction
  const currentLightDir = useMemo(() => new THREE.Vector3(), []);

  // Instantiate a static vector, holds the base light direction (top-right-front) for the shader
  const baseLightDir = useMemo(
    () => new THREE.Vector3(1.0, 1.0, 0.5).normalize(),
    []
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
    () => new THREE.BoxGeometry(100, 1000, 100, 256, 1, 256), // (width, height, depth, widthSegments, heightSegments, depthSegments)
    [],
  );

  // Leva Controls for terrain parameters
  const { Seed, Scale, Height, Octaves, Persistence } = useControls(
    "Terrain Settings",
    {
      Seed: { value: 629, min: 0, max: 1000, step: 1 },
      Scale: { value: 34.5, min: 1.0, max: 50.0 },
      Height: { value: 28.5, min: 1.0, max: 50.0 },
      Octaves: { value: 7, min: 1, max: 8, step: 1 },
      Persistence: { value: 0.45, min: 0.1, max: 1.0 },
    },
  );

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

  // Return the mesh with the custom shader material applied, passing in the uniforms for the shader
  return (
    <mesh geometry={geometry} position={[0, -500, 0]}>
      <terrainMaterial
        ref={materialRef}
        uniforms-uSeed-value={Seed}
        uniforms-uScale-value={Scale}
        uniforms-uHeight-value={Height}
        uniforms-uOctaves-value={Octaves}
        uniforms-uPersistence-value={Persistence}
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