export class ErosionSimulator {
  constructor(heightmap, mapSize) {
    this.map = heightmap;
    this.mapSize = mapSize; // 513 (for a 512 segment grid)
  }

  // --- Configuration Parameters ---
  inertia = 0.05;       // How much the droplet resists changing direction
  sedimentCapacityFactor = 4.0; // Multiplier for how much sediment a drop can hold
  minSedimentCapacity = 0.01;   // Prevents droplets from dropping everything instantly
  erodeSpeed = 0.3;     // How fast it picks up dirt
  depositSpeed = 0.3;   // How fast it drops dirt
  evaporateSpeed = 0.01;// How fast water volume decreases
  gravity = 9.8;        // Downhill acceleration
  maxDropletLifetime = 300; // Max steps before a droplet is forced to die

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
        const dropletIndex = nodeY * this.mapSize + nodeX;

        // Calculate offset inside the cell (0.0 to 1.0)
        const cellOffsetX = posX - nodeX;
        const cellOffsetY = posY - nodeY;

        // Calculate Gradient & Height
        const { height, gradientX, gradientY } = this.calculateHeightAndGradient(posX, posY);

        // Update direction and position
        dirX = (dirX * this.inertia) - (gradientX * (1 - this.inertia));
        dirY = (dirY * this.inertia) - (gradientY * (1 - this.inertia));

        // Normalize direction
        const len = Math.sqrt(dirX * dirX + dirY * dirY);
        if (len !== 0) {
          dirX /= len;
          dirY /= len;
        }

        posX += dirX;
        posY += dirY;

        // Stop simulating if it falls off the map
        if (posX < 0 || posX >= this.mapSize - 1 || posY < 0 || posY >= this.mapSize - 1) {
          break;
        }

        // Calculate new height to find height difference (slope)
        const newHeight = this.calculateHeightAndGradient(posX, posY).height;
        const deltaHeight = newHeight - height;

        // Calculate Sediment Capacity
        // Capacity is higher if it's moving fast down a steep slope
        const capacity = Math.max(-deltaHeight * speed * water * this.sedimentCapacityFactor, this.minSedimentCapacity);

        // Erode or Deposit
        if (sediment > capacity || deltaHeight > 0) {
          // If moving uphill (deltaHeight > 0) or holding too much, drop sediment
          // If uphill, try to fill the hole completely
          const amountToDeposit = (deltaHeight > 0) ? Math.min(deltaHeight, sediment) : (sediment - capacity) * this.depositSpeed;
          sediment -= amountToDeposit;

          // Add height back to the 4 nodes of the current cell using bilinear interpolation
          this.deposit(nodeX, nodeY, cellOffsetX, cellOffsetY, amountToDeposit);
        } else {
          // Erode terrain
          const amountToErode = Math.min((capacity - sediment) * this.erodeSpeed, -deltaHeight);
          sediment += amountToErode;
          this.erode(nodeX, nodeY, cellOffsetX, cellOffsetY, amountToErode);
        }

        // Update speed and evaporate
        speed = Math.sqrt(Math.max(0, speed * speed + deltaHeight * this.gravity));
        water *= (1 - this.evaporateSpeed);

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
    const nodeIndexNW = nodeY * mapSize + nodeX;         // Top-Left
    const nodeIndexNE = nodeIndexNW + 1;                 // Top-Right
    const nodeIndexSW = nodeIndexNW + mapSize;           // Bottom-Left
    const nodeIndexSE = nodeIndexSW + 1;                 // Bottom-Right

    // Get the current heights of the 4 corners from the Float32Array
    const hNW = this.map[nodeIndexNW];
    const hNE = this.map[nodeIndexNE];
    const hSW = this.map[nodeIndexSW];
    const hSE = this.map[nodeIndexSE];

    // Calculate the gradient (slope direction) using bilinear interpolation
    const gradientX = (hNE - hNW) * (1 - v) + (hSE - hSW) * v;
    const gradientY = (hSW - hNW) * (1 - u) + (hSE - hNE) * u;

    // Calculate the exact height at the droplet's floating-point position
    const height = hNW * (1 - u) * (1 - v) +
                   hNE * u * (1 - v) +
                   hSW * (1 - u) * v +
                   hSE * u * v;

    return { height, gradientX, gradientY };
  }

  // Deposits sediment back into the terrain at the droplet's current position using bilinear interpolation
  deposit(nodeX, nodeY, cellOffsetX, cellOffsetY, amount) {
    const mapSize = this.mapSize;
    const u = cellOffsetX;
    const v = cellOffsetY;

    // Calculate how much of the sediment goes to each of the 4 corners
    // A corner gets more sediment the closer the droplet is to it
    const wNW = (1 - u) * (1 - v);
    const wNE = u * (1 - v);
    const wSW = (1 - u) * v;
    const wSE = u * v;

    const nodeIndexNW = nodeY * mapSize + nodeX;

    // Add the proportional sediment amount back to the terrain heights
    this.map[nodeIndexNW]             += amount * wNW;
    this.map[nodeIndexNW + 1]         += amount * wNE;
    this.map[nodeIndexNW + mapSize]   += amount * wSW;
    this.map[nodeIndexNW + mapSize + 1] += amount * wSE;
  }

  // Erodes terrain at the droplet's current position using bilinear interpolation
  erode(nodeX, nodeY, cellOffsetX, cellOffsetY, amount) {
    const mapSize = this.mapSize;
    const u = cellOffsetX;
    const v = cellOffsetY;

    // We use the exact same weighting system as deposit to remove dirt
    const wNW = (1 - u) * (1 - v);
    const wNE = u * (1 - v);
    const wSW = (1 - u) * v;
    const wSE = u * v;

    const nodeIndexNW = nodeY * mapSize + nodeX;

    // Subtract the proportional sediment amount from the terrain heights
    this.map[nodeIndexNW]             -= amount * wNW;
    this.map[nodeIndexNW + 1]         -= amount * wNE;
    this.map[nodeIndexNW + mapSize]   -= amount * wSW;
    this.map[nodeIndexNW + mapSize + 1] -= amount * wSE;
  }
}