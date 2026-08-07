/**
 * GLSL Math Emulation Functions
 */
function fract(x) { return x - Math.floor(x); }
function mod289(x) { return x - Math.floor(x * (1.0 / 289.0)) * 289.0; }
function permute(x) { return mod289(((x * 34.0) + 1.0) * x); }
function mix(a, b, t) { return a * (1.0 - t) + b * t; }

/**
 * JS implementation of the TerrainShader GLSL cnoise function
 */
function cnoise(px, py) {
  // floor(P.xyxy) + vec4(0, 0, 1, 1)
  let ix0 = Math.floor(px);
  let iy0 = Math.floor(py);
  let ix1 = ix0 + 1.0;
  let iy1 = iy0 + 1.0;

  // fract(P.xyxy) - vec4(0, 0, 1, 1)
  let fx0 = px - ix0;
  let fy0 = py - iy0;
  let fx1 = fx0 - 1.0;
  let fy1 = fy0 - 1.0;

  // cellLoc = mod(cellLoc, 289.0)
  ix0 = mod289(ix0);
  iy0 = mod289(iy0);
  ix1 = mod289(ix1);
  iy1 = mod289(iy1);

  // i = permute(permute(ix) + iy)
  let i00 = permute(permute(ix0) + iy0);
  let i10 = permute(permute(ix1) + iy0);
  let i01 = permute(permute(ix0) + iy1);
  let i11 = permute(permute(ix1) + iy1);

  // gx = 2.0 * fract(i * 0.0243902439) - 1.0;
  let gx00 = 2.0 * fract(i00 * 0.0243902439) - 1.0;
  let gx10 = 2.0 * fract(i10 * 0.0243902439) - 1.0;
  let gx01 = 2.0 * fract(i01 * 0.0243902439) - 1.0;
  let gx11 = 2.0 * fract(i11 * 0.0243902439) - 1.0;

  // gy = abs(gx) - 0.5
  let gy00 = Math.abs(gx00) - 0.5;
  let gy10 = Math.abs(gx10) - 0.5;
  let gy01 = Math.abs(gx01) - 0.5;
  let gy11 = Math.abs(gx11) - 0.5;

  // tx = floor(gx + 0.5); gx = gx - tx;
  let tx00 = Math.floor(gx00 + 0.5); gx00 -= tx00;
  let tx10 = Math.floor(gx10 + 0.5); gx10 -= tx10;
  let tx01 = Math.floor(gx01 + 0.5); gx01 -= tx01;
  let tx11 = Math.floor(gx11 + 0.5); gx11 -= tx11;

  // norm = 1.79284291400159 - 0.85373472095314 * dot(g,g)
  let norm00 = 1.79284291400159 - 0.85373472095314 * (gx00 * gx00 + gy00 * gy00);
  let norm10 = 1.79284291400159 - 0.85373472095314 * (gx10 * gx10 + gy10 * gy10);
  let norm01 = 1.79284291400159 - 0.85373472095314 * (gx01 * gx01 + gy01 * gy01);
  let norm11 = 1.79284291400159 - 0.85373472095314 * (gx11 * gx11 + gy11 * gy11);

  gx00 *= norm00; gy00 *= norm00;
  gx10 *= norm10; gy10 *= norm10;
  gx01 *= norm01; gy01 *= norm01;
  gx11 *= norm11; gy11 *= norm11;

  // dot products
  let n00 = gx00 * fx0 + gy00 * fy0;
  let n10 = gx10 * fx1 + gy10 * fy0;
  let n01 = gx01 * fx0 + gy01 * fy1;
  let n11 = gx11 * fx1 + gy11 * fy1;

  // Perlin's Quintic Curve fade function
  let fade_x = fx0 * fx0 * fx0 * (fx0 * (fx0 * 6.0 - 15.0) + 10.0);
  let fade_y = fy0 * fy0 * fy0 * (fy0 * (fy0 * 6.0 - 15.0) + 10.0);

  // mix
  let n_x0 = mix(n00, n10, fade_x);
  let n_x1 = mix(n01, n11, fade_x);
  let n_xy = mix(n_x0, n_x1, fade_y);

  return 2.3 * n_xy;
}

/**
 * JS implementation of the TerrainShader GLSL fbm function
 */
function fbm(px, py, octaves, persistence, seed) {
  let value = 0.0;
  let amplitude = 1.0;
  let frequency = 1.0;

  for (let i = 0; i < octaves; i++) {
    // Note: your shader adds uSeed after multiplying by frequency
    value += amplitude * cnoise(px * frequency + seed, py * frequency + seed);
    frequency *= 2.0;
    amplitude *= persistence;
  }
  return value;
}

/**
 * Generates the Float32Array by mapping 2D indexes to 3D world space
 */
export function generateCPUHeightmap(segments, terrainSize, params) {
  const { Seed, Scale, Height, Octaves, Persistence } = params;
  
  const resolution = segments + 1;
  const heightmap = new Float32Array(resolution * resolution);
  
  // We need the half size to map indices 0 -> 512 to world coordinates -50 -> 50
  const halfSize = terrainSize / 2.0;

  for (let zIndex = 0; zIndex < resolution; zIndex++) {
    for (let xIndex = 0; xIndex < resolution; xIndex++) {
      
      // Convert array indices to world coordinates (px, pz)
      // Matches a THREE.PlaneGeometry spanning from -50 to 50
      const px = (xIndex / segments) * terrainSize - halfSize;
      const pz = (zIndex / segments) * terrainSize - halfSize;

      // Exact equivalent of getElevation() in shader
      const h = fbm(px * (1.0 / Scale), pz * (1.0 / Scale), Octaves, Persistence, Seed) * Height;

      // Calculate flat array index
      const index = xIndex + (zIndex * resolution);
      
      heightmap[index] = h;
    }
  }

  return heightmap;
}