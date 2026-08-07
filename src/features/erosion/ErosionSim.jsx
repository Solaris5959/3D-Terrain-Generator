import React, { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { extend, useFrame } from "@react-three/fiber";
import { useControls, button } from "leva";
import { ErosionSimulator } from "./ErosionAlgorithm";
import {
  bakedVertexShader,
  fragmentShader,
} from "../shared/shaders/TerrainShaders";
import { TERRAIN_PALETTES, TERRAIN_SEGMENTS } from "../../lib/Constants";

// Create a new material class for the baked shader
class BakedTerrainMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      uniforms: {
        uSnowLine: { value: 20.0 },
        uTreeLine: { value: 5.0 },
        uBlendSoftness: { value: 2.0 },
        uSnowColor: { value: new THREE.Color("#FFFFFF") },
        uRockColor: { value: new THREE.Color("#8A7D72") },
        uTreeColor: { value: new THREE.Color("#407239") },
        uLightDir: { value: new THREE.Vector3(1.0, 1.0, 0.5) },
      },
      vertexShader: bakedVertexShader,
      fragmentShader: fragmentShader,
      wireframe: false,
    });
  }
}
extend({ BakedTerrainMaterial });

export default function ErosionSim({ initialData, onReturn }) {
  const { heights, terrainSize } = initialData;
  const materialRef = useRef();
  const geometryRef = useRef();
  const [isSimulating, setIsSimulating] = useState(false);

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

  // Duplicate of Biome settings Leva control panel from Terrain component
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

  // Leva controls for erosion parameters
  useControls("Erosion Settings", () => ({
    DropCount: { value: 100000, min: 1000, max: 10000000, step: 1000 },
    ErosionRate: { value: 0.1, min: 0.01, max: 1.0 },
    "Run Erosion": button((get) => {
      // get() reaches directly into Leva's internal state store via the folder path
      const liveDropCount = get("Erosion Settings.DropCount");
      const liveErosionRate = get("Erosion Settings.ErosionRate");

      runSimulation(liveDropCount, liveErosionRate);
    }),
    "Return to Generator": button(() => {
      onReturn();
    }),
  }));

  // Erosion simulation function that modifies the heightmap and updates the mesh geometry
  const runSimulation = (currentDropCount, currentErosionRate) => {
    if (!geometryRef.current) return;

    setIsSimulating(true);

    const currentHeights = new Float32Array(heights);
    const sim = new ErosionSimulator(currentHeights, TERRAIN_SEGMENTS + 1);

    // Use the passed argument
    sim.erodeSpeed = currentErosionRate;

    // Use the passed argument
    const newHeights = sim.simulate(currentDropCount);

    const geometry = geometryRef.current.geometry;
    const positions = geometry.attributes.position.array;

    for (let i = 0; i < newHeights.length; i++) {
      positions[i * 3 + 1] = newHeights[i];
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();

    setIsSimulating(false);
  };

  // Generate the geometry for the terrain mesh based on the current heights and resolution
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(
      terrainSize,
      terrainSize,
      TERRAIN_SEGMENTS,
      TERRAIN_SEGMENTS,
    );
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, [terrainSize]);

  // Sync heights to the mesh via useEffect whenever the heights prop changes
  React.useEffect(() => {
    if (!geometryRef.current) return;

    const geo = geometryRef.current.geometry;
    const positions = geo.attributes.position.array;

    for (let i = 0; i < heights.length; i++) {
      positions[i * 3 + 1] = heights[i];
    }

    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  }, [heights]);

  // Update shader uniforms for biome settings whenever they change
  return (
    <mesh geometry={geometry} position={[0, 0, 0]} ref={geometryRef}>
      <bakedTerrainMaterial
        ref={materialRef}
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
