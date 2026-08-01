import React, { useMemo } from "react";
import * as THREE from "three";
import { extend } from "@react-three/fiber";
import { useControls } from "leva";

class TerrainMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      // Define uniforms for the GPU shader
      uniforms: {
        uSeed: { value: 42.0 },
        uScale: { value: 10.0 },
        uHeight: { value: 15.0 },
        uOctaves: { value: 4 },
        uPersistence: { value: 0.5 },
      },

      vertexShader: `
        // Import uniforms and varyings needed for the vertex shader
        uniform float uSeed;
        uniform float uScale;
        uniform float uHeight;
        uniform int uOctaves;
        uniform float uPersistence;
        varying float vHeight;
        
        // --- Perlin Noise Functions ---

        // Permutation function to hash pseudo-random gradients: f(x) = (34x^2 + x) mod 289
        vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

        // 2D Perlin noise function
        float cnoise(vec2 P){
          vec4 cellLoc = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
          vec4 pointLocInCell = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);

          cellLoc = mod(cellLoc, 289.0); // To avoid truncation effects in permutation

          // Pack the cell coordinates and point locations for gradient calculation
          vec4 ix = cellLoc.xzxz;
          vec4 iy = cellLoc.yyww;
          vec4 fx = pointLocInCell.xzxz;
          vec4 fy = pointLocInCell.yyww;

          // Generate hash values for the 4 corners of the cell
          vec4 i = permute(permute(ix) + iy);
          
          // Generates the x components of the gradient vectors for the 4 corners of the cell, in range [-1, 1]
          vec4 gx = 2.0 * fract(i * 0.0243902439) - 1.0; // 0.0243902439 = 1/41, to map to [0,1] range, works with the 289 modulus in permute function

          // Uses our x components to generate the y components of the gradient vectors for the 4 corners of the cell, either -0.5 or 0.5 (keeps the xy-pairs on a geometric rhombus)
          vec4 gy = abs(gx) - 0.5;

          // Distributes the random x components to one of {-1, 0, 1}, folding the 1D gradient vector into a 2D rhombus shape, and then normalizes the gradient vectors to unit length
          vec4 tx = floor(gx + 0.5);
          gx = gx - tx;

          vec2 g00 = vec2(gx.x, gy.x);
          vec2 g10 = vec2(gx.y, gy.y);
          vec2 g01 = vec2(gx.z, gy.z);
          vec2 g11 = vec2(gx.w, gy.w);

          // Taylor Series approximation for 1/sqrt(x) to normalize the gradient vectors (maps the rhombus vectors to the unit circle)
          vec4 norm = 1.79284291400159 - 0.85373472095314 * vec4(dot(g00, g00), dot(g10, g10), dot(g01, g01), dot(g11, g11)); 

          g00 *= norm.x;
          g10 *= norm.y;
          g01 *= norm.z;
          g11 *= norm.w;

          // Compute the dot product of the gradient vectors with the distance vectors from the corners of the cell to the point, which gives the contribution of each corner to the final noise value
          // If the gradient vector is pointing towards the point, the dot product will be positive, and if it's pointing away, it will be negative.
          float n00 = dot(g00, vec2(fx.x, fy.x));
          float n10 = dot(g10, vec2(fx.y, fy.y));
          float n01 = dot(g01, vec2(fx.z, fy.z));
          float n11 = dot(g11, vec2(fx.w, fy.w));

          // Perlin's Quintic Curve fade function: f(x) = 6x^5 - 15x^4 + 10x^3, which smooths the interpolation between the contributions of the corners of the cell
          vec2 fade_xyz = pointLocInCell.xy * pointLocInCell.xy * pointLocInCell.xy * (pointLocInCell.xy * (pointLocInCell.xy * 6.0 - 15.0) + 10.0);
          vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xyz.x);
          float n_xy = mix(n_x.x, n_x.y, fade_xyz.y); // The first and second derivatives of the noise function at the boundaries of the cell are zero, makes the terrain continuous


          return 2.3 * n_xy; // Stretch the noise value to the range [-1, 1] for better terrain height variation
        }

        // Fractal Brownian Motion (FBM) Loop
        float fbm(vec2 p) {
          float value = 0.0;
          float amplitude = 1.0;
          float frequency = 1.0;
          
          // Loop through octaves to layer noise at different frequencies and amplitudes
          for (int i = 0; i < uOctaves; i++) {
            value += amplitude * cnoise(p * frequency + uSeed); // Samples noise function at increasing frequencies and decreasing amplitudes, adding more detail to the terrain

            frequency *= 2.0; // Double the frequency for the next octave, increases the detail of the noise
            amplitude *= uPersistence; // Each loop will have less influence on the final noise value (height)
          }
          return value;
        }

        void main() {
          // Calculate the noise coordinate based on the vertex position and scale
          vec2 noiseCoord = position.xy * (1.0 / uScale);
          
          // Send it through the FBM function to get the final noise value for this vertex
          float rawNoise = fbm(noiseCoord);
          
          // Scale the noise value by the height multiplier to get the final height of the terrain at this vertex
          vec3 newPosition = position;
          newPosition.z = rawNoise * uHeight; 
          vHeight = rawNoise; 
          
          // Set the final position of the vertex in clip space
          gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
        }
      `,

      fragmentShader: `
        varying float vHeight;
        void main() {
          vec3 wireframeColor = vec3(0.7, 0.7, 0.7);
          gl_FragColor = vec4(wireframeColor, 1.0);
        }
      `,
      wireframe: true,
    });
  }
}

extend({ TerrainMaterial });

export default function Terrain({ started }) {
  // UseMemo prevents the geometry from rebuilding every frame
  const geometry = useMemo(
    () => new THREE.PlaneGeometry(100, 100, 256, 256),
    [],
  );

  // Leva Controls for terrain parameters
  const { seed, scale, heightMultiplier, octaves, persistence } = useControls(
    "Terrain Settings",
    {
      seed: { value: 42, min: 0, max: 1000, step: 1 },
      scale: { value: 10.0, min: 1.0, max: 50.0 },
      heightMultiplier: { value: 15.0, min: 1.0, max: 50.0 },
      octaves: { value: 4, min: 1, max: 8, step: 1 },
      persistence: { value: 0.5, min: 0.1, max: 1.0 },
    },
  );

  // Return the mesh with the custom shader material applied, passing in the uniforms for the shader
  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
    >
      <terrainMaterial
        uniforms-uSeed-value={seed}
        uniforms-uScale-value={scale}
        uniforms-uHeight-value={heightMultiplier}
        uniforms-uOctaves-value={octaves}
        uniforms-uPersistence-value={persistence}
      />
    </mesh>
  );
}
