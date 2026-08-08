export class ErosionSimulator {
  constructor(heightmap, mapSize) {
    this.map = heightmap;
    this.mapSize = mapSize; // 513 (for a 512 segment grid)

    this.erosionRadius = 3; // Radius of the erosion brush in vertices
    this.brushIndices = []; // Pre-calculated neighbor indices for every node
    this.brushWeights = []; // Pre-calculated weights for every node

    this.initializeBrush();
  }

  // --- Hydraulic Erosion Parameters ---
  inertia = 0.05; // How much the droplet resists changing direction
  sedimentCapacityFactor = 4.0; // Multiplier for how much sediment a drop can hold
  minSedimentCapacity = 0.01; // Prevents droplets from dropping everything instantly
  erodeSpeed = 0.3; // How fast it picks up dirt
  depositSpeed = 0.3; // How fast it drops dirt
  evaporateSpeed = 0.01; // How fast water volume decreases
  gravity = 9.8; // Downhill acceleration
  maxDropletLifetime = 200; // Max steps before a droplet is forced to die

  // Pre-calculates the brush weights for every node on the map
  initializeBrush() {
    const radius = this.erosionRadius;

    for (let i = 0; i < this.mapSize * this.mapSize; i++) {
      let centerX = i % this.mapSize;
      let centerY = Math.floor(i / this.mapSize);

      let nodeIndices = [];
      let nodeWeights = [];
      let weightSum = 0;

      // Check a bounding box around the current node
      for (let y = -radius; y <= radius; y++) {
        for (let x = -radius; x <= radius; x++) {
          let sqrDst = x * x + y * y;

          // If the node is within the circle radius
          if (sqrDst < radius * radius) {
            let coordX = centerX + x;
            let coordY = centerY + y;

            // Ensure the node is inside the map bounds
            if (
              coordX >= 0 &&
              coordX < this.mapSize &&
              coordY >= 0 &&
              coordY < this.mapSize
            ) {
              // Weight is higher the closer we are to the center
              let weight = 1 - Math.sqrt(sqrDst) / radius;
              weightSum += weight;
              nodeIndices.push(coordY * this.mapSize + coordX);
              nodeWeights.push(weight);
            }
          }
        }
      }

      // Normalize weights so they always sum up to exactly 1.0
      for (let j = 0; j < nodeWeights.length; j++) {
        nodeWeights[j] /= weightSum;
      }

      this.brushIndices[i] = nodeIndices;
      this.brushWeights[i] = nodeWeights;
    }
  }

  simulate(dropletCount) {
    for (let i = 0; i < dropletCount; i++) {
      // Spawn Droplets at Random Positions
      let posX = Math.random() * (this.mapSize - 1);
      let posY = Math.random() * (this.mapSize - 1);
      let dirX = 0;
      let dirY = 0;
      let speed = 1.0;
      let water = 1.0;
      let sediment = 0.0;

      for (let lifetime = 0; lifetime < this.maxDropletLifetime; lifetime++) {
        const nodeX = Math.floor(posX);
        const nodeY = Math.floor(posY);

        // Calculate Gradient & Height
        const { height, gradientX, gradientY } =
          this.calculateHeightAndGradient(posX, posY);

        // Update direction and position
        dirX = dirX * this.inertia - gradientX * (1 - this.inertia);
        dirY = dirY * this.inertia - gradientY * (1 - this.inertia);

        // Normalize direction
        const len = Math.sqrt(dirX * dirX + dirY * dirY);
        if (len !== 0) {
          dirX /= len;
          dirY /= len;
        }

        posX += dirX;
        posY += dirY;

        // Stop simulating if it falls off the map
        if (
          posX < 0 ||
          posX >= this.mapSize - 1 ||
          posY < 0 ||
          posY >= this.mapSize - 1
        ) {
          break;
        }

        // Calculate new height to find height difference (slope)
        const newHeight = this.calculateHeightAndGradient(posX, posY).height;
        const deltaHeight = newHeight - height;

        // Calculate Sediment Capacity
        // Capacity is higher if it's moving fast down a steep slope
        const capacity = Math.max(
          -deltaHeight * speed * water * this.sedimentCapacityFactor,
          this.minSedimentCapacity,
        );

        // Erode or Deposit
        if (sediment > capacity || deltaHeight > 0) {
          // If moving uphill (deltaHeight > 0) or holding too much, drop sediment
          // If uphill, try to fill the hole completely
          const amountToDeposit =
            deltaHeight > 0
              ? Math.min(deltaHeight, sediment)
              : (sediment - capacity) * this.depositSpeed;
          sediment -= amountToDeposit;

          // Add height back using the pre-calculated brush
          this.deposit(nodeX, nodeY, amountToDeposit);
        } else {
          // Erode terrain
          const amountToErode = Math.min(
            (capacity - sediment) * this.erodeSpeed,
            -deltaHeight,
          );
          sediment += amountToErode;

          // Remove height using the pre-calculated brush
          this.erode(nodeX, nodeY, amountToErode);
        }

        // Update speed and evaporate
        speed = Math.sqrt(
          Math.max(0, speed * speed - deltaHeight * this.gravity),
        );
        water *= 1 - this.evaporateSpeed;

        if (water < 0.01) break; // Droplet is dead
      }
    }

    // Return the modified array
    return this.map;
  }

  // --- Helper Functions for ErosionSimulator ---

  // Calculates the height and gradient at a given floating-point position (posX, posY) using bilinear interpolation
  calculateHeightAndGradient(posX, posY) {
    const mapSize = this.mapSize;

    // Get the integer coordinates of the top-left node of the current cell
    const nodeX = Math.floor(posX);
    const nodeY = Math.floor(posY);

    // Get the fractional offset inside the cell (u, v will be between 0.0 and 1.0)
    const u = posX - nodeX;
    const v = posY - nodeY;

    // Calculate the 1D array indices for the 4 corners of the cell
    const nodeIndexNW = nodeY * mapSize + nodeX; // Top-Left
    const nodeIndexNE = nodeIndexNW + 1; // Top-Right
    const nodeIndexSW = nodeIndexNW + mapSize; // Bottom-Left
    const nodeIndexSE = nodeIndexSW + 1; // Bottom-Right

    // Get the current heights of the 4 corners from the Float32Array
    const hNW = this.map[nodeIndexNW];
    const hNE = this.map[nodeIndexNE];
    const hSW = this.map[nodeIndexSW];
    const hSE = this.map[nodeIndexSE];

    // Calculate the gradient (slope direction) using bilinear interpolation
    const gradientX = (hNE - hNW) * (1 - v) + (hSE - hSW) * v;
    const gradientY = (hSW - hNW) * (1 - u) + (hSE - hNE) * u;

    // Calculate the exact height at the droplet's floating-point position
    const height =
      hNW * (1 - u) * (1 - v) +
      hNE * u * (1 - v) +
      hSW * (1 - u) * v +
      hSE * u * v;

    return { height, gradientX, gradientY };
  }

  // Deposits sediment using the pre-calculated circular brush
  deposit(nodeX, nodeY, amount) {
    const nodeIndex = nodeY * this.mapSize + nodeX;
    const brushIndexList = this.brushIndices[nodeIndex];
    const brushWeightList = this.brushWeights[nodeIndex];

    for (let i = 0; i < brushIndexList.length; i++) { // Iterate through all neighbors in the brush
      const neighborIndex = brushIndexList[i];
      const weight = brushWeightList[i];

      this.map[neighborIndex] += amount * weight; // Increase the height of the neighbor based on the weight
    }
  }

  // Erodes terrain using the pre-calculated circular brush
  erode(nodeX, nodeY, amount) {
    const nodeIndex = nodeY * this.mapSize + nodeX;
    const brushIndexList = this.brushIndices[nodeIndex];
    const brushWeightList = this.brushWeights[nodeIndex];

    for (let i = 0; i < brushIndexList.length; i++) { // Iterate through all neighbors in the brush
      const neighborIndex = brushIndexList[i];
      const weight = brushWeightList[i];

      this.map[neighborIndex] -= amount * weight; // Decrease the height of the neighbor based on the weight
    }
  }
}
