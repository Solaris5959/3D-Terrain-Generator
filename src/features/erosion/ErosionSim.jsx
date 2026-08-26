import React, { useMemo, useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { extend, useFrame } from "@react-three/fiber";
import { useControls, button } from "leva";
import { ErosionSimulator } from "./ErosionAlgorithm";
import {
  bakedVertexShader,
  fragmentShader,
} from "../shared/shaders/TerrainShaders";
import { TERRAIN_PALETTES } from "../../lib/Constants";

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
  const { insaneMode, segments, heights, terrainSize } = initialData;
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
    DropCount: { value: 12000, min: 1000, max: insaneMode ? 500000 : 50000, step: 1000 },
    ErosionRate: { value: 0.1, min: 0.01, max: 1.0 },
    TalusAngle: { value: 0.8, min: 0.1, max: 3.0, step: 0.1 },
    ThermalIterations: { value: 10, min: 0, max: insaneMode ? 500 : 20, step: 1 },
    "Run Erosion": button((get) => {
      // get() reaches directly into Leva's internal state store via the folder path
      const liveDropCount = get("Erosion Settings.DropCount");
      const liveErosionRate = get("Erosion Settings.ErosionRate");
      const liveTalus = get("Erosion Settings.TalusAngle");
      const liveThermalIters = get("Erosion Settings.ThermalIterations");

      runSimulation(liveDropCount, liveErosionRate, liveTalus, liveThermalIters);
    }),
    "Return to Generator": button(() => {
      onReturn();
    }),
  }));

  // Create an unmodified BoxGeometry once to use as a structural template
  const baseGeometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(terrainSize, 1000, terrainSize, segments, 1, segments);
    
    // Determine which vertices belong to the walls vs top based on original normal
    const count = geo.attributes.position.count;
    const isWallArray = new Float32Array(count);
    const normals = geo.attributes.normal.array;
    
    for (let i = 0; i < count; i++) {
      // If the normal points up, it's terrain. Otherwise, it's a wall.
      isWallArray[i] = normals[i * 3 + 1] > 0.5 ? 0.0 : 1.0;
    }
    
    geo.setAttribute('aIsWall', new THREE.BufferAttribute(isWallArray, 1));
    return geo;
  }, [terrainSize, segments]);

  // Generate the geometry for the terrain mesh based on the current heights and resolution
  // The actual mutable geometry clone for the mesh
  const geometry = useMemo(() => baseGeometry.clone(), [baseGeometry]);

  // Helper function to map heights from the array onto the top face of the BoxGeometry
  const applyHeightsToMesh = (heightArray) => {
    const geo = geometryRef.current.geometry;
    const positions = geo.attributes.position.array;
    const basePositions = baseGeometry.attributes.position.array;
    
    const resolution = segments + 1;
    const halfSize = terrainSize / 2.0;

    for (let i = 0; i < basePositions.length; i += 3) {
      const x = basePositions[i];
      const y = basePositions[i + 1];
      const z = basePositions[i + 2];

      // Only alter the vertices at the top of the box (original y = 500)
      if (y > 0) {
        // Map 3D coordinates [-50, 50] back to 2D array index [0, segments]
        const ix = Math.round(((x + halfSize) / terrainSize) * segments);
        const iz = Math.round(((z + halfSize) / terrainSize) * segments);
        
        const safeIx = Math.max(0, Math.min(segments, ix));
        const safeIz = Math.max(0, Math.min(segments, iz));
        
        const hIndex = safeIx + (safeIz * resolution);
        
        // Push the vertex to 500 + terrain height
        positions[i + 1] = 500.0 + heightArray[hIndex];
      }
    }

    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals(); // Generates smooth terrain AND perfect flat side walls
  };

  // Erosion simulation function that modifies the heightmap and updates the mesh geometry
  const runSimulation = (currentDropCount, currentErosionRate, talus, thermalInters) => {
    if (!geometryRef.current) return;
    setIsSimulating(true);

    const currentHeights = new Float32Array(heights);
    const sim = new ErosionSimulator(currentHeights, segments + 1);

    // Use the passed argument
    sim.erodeSpeed = currentErosionRate;
    sim.talusAngle = talus;
    sim.thermalIterations = thermalInters;

    // Use the passed argument
    const newHeights = sim.simulate(currentDropCount);

    // Map the new heights back to our geometry template
    applyHeightsToMesh(newHeights);

    setIsSimulating(false);
  };

  // Sync heights to the mesh via useEffect whenever the heights prop changes
  useEffect(() => {
    if (geometryRef.current) applyHeightsToMesh(heights);
  }, [heights, segments, baseGeometry]);

  // Update shader uniforms for biome settings whenever they change
  return (
    // Note: Re-anchored mesh position at Y: -500 to match the original terrain generator exactly
    <mesh geometry={geometry} position={[0, -500, 0]} ref={geometryRef}>
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