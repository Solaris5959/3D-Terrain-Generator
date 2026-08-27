import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// Bake Helper: Renders the terrain's visual material output into a flat 2D texture map
function bakeTexture(renderer, sourceMesh, terrainSize) {
  const resolution = 2048; // Fixed resolution for the baked texture
  const rt = new THREE.WebGLRenderTarget(resolution, resolution, { // Render target to hold the GPU output
    format: THREE.RGBAFormat,
    colorSpace: THREE.SRGBColorSpace,
  });

  const half = terrainSize / 2;
  // Orthographic camera captures a flat, top-down projection of the terrain mesh
  const orthoCam = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 2000);
  orthoCam.position.set(0, 500, 0); // Position high above the center
  
  orthoCam.up.set(0, 0, -1); // Align camera up-vector
  orthoCam.lookAt(0, -500, 0); // Point camera straight down at the terrain

  const bakeScene = new THREE.Scene();
  const bakeMesh = new THREE.Mesh(sourceMesh.geometry, sourceMesh.material);
  bakeMesh.position.copy(sourceMesh.position);
  bakeScene.add(bakeMesh); // Add the duplicate mesh to the isolated bake scene

  renderer.setRenderTarget(rt);
  renderer.render(bakeScene, orthoCam); // Render the top-down view into the render target
  renderer.setRenderTarget(null); // Reset renderer to default frame buffer

  const buffer = new Uint8Array(resolution * resolution * 4); // 4 bytes per pixel (RGBA)
  renderer.readRenderTargetPixels(rt, 0, 0, resolution, resolution, buffer); // Extract pixel data from the GPU
  rt.dispose(); // Clean up render target

  // Create standard canvas elements to manipulate the extracted pixel data
  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext('2d');

  const imageData = new ImageData(new Uint8ClampedArray(buffer), resolution, resolution);
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = resolution; 
  tempCanvas.height = resolution;
  tempCanvas.getContext('2d').putImageData(imageData, 0, 0); // Dump pixel data onto temporary canvas

  // Flip Y-axis to correctly translate WebGL bottom-up memory to Canvas top-down layout
  ctx.translate(0, resolution);
  ctx.scale(1, -1);
  ctx.drawImage(tempCanvas, 0, 0);

  const bakedTexture = new THREE.CanvasTexture(canvas); // Convert finalized canvas back into a THREE texture
  bakedTexture.colorSpace = THREE.SRGBColorSpace;
  bakedTexture.flipY = false; // Prevent double flipping
  
  return bakedTexture;
}

// Export function: Generates a 3D model file (.glb) containing the terrain mesh and textures
export function exportTerrainToGLB(gl, sourceMesh, heights, segments, terrainSize, includeTextures, onComplete, onError) {
  try {
    // Create a base plane geometry with the specified size and subdivision segments
    const exportGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
    exportGeo.rotateX(-Math.PI / 2); // Rotate to lay flat along the XZ plane
    
    const positions = exportGeo.attributes.position.array;
    const halfSize = terrainSize / 2;
    const res = segments + 1; // Number of vertices per row/column

    // Iterate over all vertices to apply height values from the terrain generation simulation
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const z = positions[i + 2];
      
      // Map world coordinates to grid indices in the heights array
      const ix = Math.round(((x + halfSize) / terrainSize) * segments);
      const iz = Math.round(((z + halfSize) / terrainSize) * segments);
      
      // Clamp indices to ensure they fall safely within bounds
      const safeIx = Math.max(0, Math.min(segments, ix));
      const safeIz = Math.max(0, Math.min(segments, iz));
      
      const hIndex = safeIx + (safeIz * res);
      positions[i + 1] = heights[hIndex]; // Apply Y (height) value
    }

    const uvArray = new Float32Array((positions.length / 3) * 2); // 2 floats (U, V) per vertex
    // Generate UV mapping coordinates to ensure the texture maps correctly across the mesh
    for (let i = 0, j = 0; i < positions.length; i += 3, j += 2) {
      uvArray[j] = (positions[i] + halfSize) / terrainSize;       // U (X-axis)
      uvArray[j + 1] = (positions[i + 2] + halfSize) / terrainSize; // V (Z-axis)
    }
    exportGeo.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
    
    // Recalculate lighting normals and bounds after modifying vertex positions
    exportGeo.computeVertexNormals();
    exportGeo.computeBoundingBox();

    let exportMaterial;
    // Determine if the exported model should include baked texture materials
    if (includeTextures && gl && sourceMesh) {
      const bakedMap = bakeTexture(gl, sourceMesh, terrainSize); // Generate the terrain color map
      exportMaterial = new THREE.MeshStandardMaterial({ 
          map: bakedMap,
          roughness: 0.9,
          side: THREE.DoubleSide
      });
    } else {
      // Fallback to a solid color if textures are omitted or unavailable
      exportMaterial = new THREE.MeshStandardMaterial({ 
          color: 0xcccccc, 
          roughness: 0.8,
          side: THREE.DoubleSide
      });
    }
    
    const exportMesh = new THREE.Mesh(exportGeo, exportMaterial);

    // Initialize Three.js GLTF Exporter
    const exporter = new GLTFExporter();
    exporter.parse(
      exportMesh,
      (gltf) => {
        // Convert the resulting buffer into a downloadable blob
        const blob = new Blob([gltf], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.style.display = 'none';
        link.href = url;
        link.download = 'textured_terrain.glb'; // Set output filename
        document.body.appendChild(link);
        link.click(); // Trigger automatic download
        document.body.removeChild(link); // Clean up DOM
        URL.revokeObjectURL(url); // Free up memory
        if (onComplete) onComplete(); // Trigger success callback
      },
      (error) => {
        console.error("GLTF Parse Error:", error);
        if (onError) onError(error);
      },
      { binary: true } // Export as binary GLB format instead of JSON GLTF
    );
  } catch (error) {
    console.error("Export Setup Error:", error);
    if (onError) onError(error);
  }
}