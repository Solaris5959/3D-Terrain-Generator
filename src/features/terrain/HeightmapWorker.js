import { generateCPUHeightmap } from "../../lib/noise/NoiseUtils";

// Worker Process to run the one-time height map calculation (on CPU)
self.onmessage = function (e) {
  const { numSegments, terrainSize, liveParams } = e.data;

  // Run generation process
  const heightMap = generateCPUHeightmap(numSegments, terrainSize, liveParams);

  // Send result back to the main thread
  // Passes the Float32Array buffer directly as a transferable object
  self.postMessage({ heightMap }, [heightMap.buffer]);
};
