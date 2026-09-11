import { ErosionSimulator } from "./ErosionAlgorithm";

// Worker Process for running erosion simulation
self.onmessage = function (e) {
  const { heights, segments, dropCount, erosionRate, talus, thermalIters } =
    e.data;

  // heights is passed as a Float32Array
  const sim = new ErosionSimulator(heights, segments + 1);

  // Apply parameters
  sim.erodeSpeed = erosionRate;
  sim.talusAngle = talus;
  sim.thermalIterations = thermalIters;

  // Run the simulation calculation
  const newHeights = sim.simulate(dropCount);

  // Send the new heightmap back to the main thread
  self.postMessage({ newHeights }, [newHeights.buffer]);
};
