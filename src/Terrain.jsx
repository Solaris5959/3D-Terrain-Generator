import React, { useMemo } from "react";
import * as THREE from "three";
import { extend } from "@react-three/fiber";
import { useControls } from "leva";
import { vertexShader, fragmentShader } from "./Shaders/TerrainShaders";

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
      },
      vertexShader,
      fragmentShader,
      wireframe: false,
    });
  }
}

extend({ TerrainMaterial });

export default function Terrain() {
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
  const { SnowLine, TreeLine, BlendSoftness } = useControls("Biome Settings", {
    SnowLine: { value: 10.0, min: -20.0, max: 40.0 },
    TreeLine: { value: -11.0, min: -40.0, max: 40.0 },
    BlendSoftness: { value: 8.0, min: 0.1, max: 10.0 },
  });

  // Return the mesh with the custom shader material applied, passing in the uniforms for the shader
  return (
    <mesh geometry={geometry} position={[0, -500, 0]}>
      <terrainMaterial
        uniforms-uSeed-value={Seed}
        uniforms-uScale-value={Scale}
        uniforms-uHeight-value={Height}
        uniforms-uOctaves-value={Octaves}
        uniforms-uPersistence-value={Persistence}
        uniforms-uSnowLine-value={SnowLine}
        uniforms-uTreeLine-value={TreeLine}
        uniforms-uBlendSoftness-value={BlendSoftness}
      />
    </mesh>
  );
}
