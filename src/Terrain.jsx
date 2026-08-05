import React, { useMemo } from "react";
import * as THREE from "three";
import { extend } from "@react-three/fiber";
import { useControls } from "leva";

class TerrainMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      // Define uniforms for the GPU shader
      uniforms: {
        uSeed: { value: 735.0 },
        uScale: { value: 22.5 },
        uHeight: { value: 12.0 },
        uOctaves: { value: 6 },
        uPersistence: { value: 0.45 },
      },

      vertexShader: `
        // Import uniforms and varyings needed for the vertex shader
        uniform float uSeed;
        uniform float uScale;
        uniform float uHeight;
        uniform int uOctaves;
        uniform float uPersistence;
        varying float vHeight;
        varying vec3 vNormal;
        
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

        // Helper function to get the elevation of the terrain at a given point, using FBM and scaling it by the height multiplier
        float getElevation(vec2 p) {
          return fbm(p * (1.0 / uScale)) * uHeight;
        }

        void main() {
          vec3 newPosition = position;
          
          // Check if the vertex is on the top face of the BoxGeometry
          // Our box is 10 units high, so top vertices start at Y = 5.0
          if (position.y > 0.0) {
            
            // Get the height of the current vertex (Sampling XZ for the 3D box)
            float h = getElevation(position.xz);
            
            // Calculate the tangent vectors at point position by sampling height at small offsets in x and z
            float step = 0.01; 
            float hx = getElevation(position.xz + vec2(step, 0.0));
            float hz = getElevation(position.xz + vec2(0.0, step));
            
            // Construct the tangent vectors in the x and z directions
            // Note: Because Y is the vertical axis for our box, the height difference goes in the Y component
            vec3 t1 = vec3(step, hx - h, 0.0); 
            vec3 t2 = vec3(0.0, hz - h, step); 
            
            // Cross product of tangents gives us the normal vector, normalize it to unit length, 
            // and transform it to world space using the model matrix
            vec3 localNormal = normalize(cross(t2, t1)); // cross(t2, t1) ensures it points UP
            vNormal = normalize(mat3(modelMatrix) * localNormal);
            
            // Displace the vertex along y-axis by value of height function, 
            // and pass the height to the fragment shader for lighting and coloring
            newPosition.y += h; 
            vHeight = h; 
            
          } else {
            // If it is the wall or bottom, don't displace it!
            // Just pass the default flat normal of the box so walls light flatly.
            vHeight = -10.0; // Artificial low height to color the walls dark
            vNormal = normalize(mat3(modelMatrix) * normal);
          }
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
        }
      `,

      fragmentShader: `
        varying float vHeight;
        varying vec3 vNormal;
        float ambientLightIntensity = 0.15; // Ambient Light Intensity, affects shadows
        float diffuseLightIntensity = 0.9; // Diffuse Light Intensity, affects highlights
        
        void main() {
          // Defines the light source coming from the top-right-front
          vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
          
          // Calculate Lambertian reflectance, dot product and clamp minimum to 0.0 to get shadows
          float diffuse = max(dot(vNormal, lightDir), 0.0);
          
          // Calculate final lighting amount by ambient + diffuse, adjust globals to control the overall brightness and contrast of the terrain
          float lighting = ambientLightIntensity + (diffuse * diffuseLightIntensity);
          
          vec3 color;
          vec3 terrainColor = vec3( 0.435, 0.318, 0.153); // #6F5127 (brown) Base terrain color
          vec3 boxColor = vec3(0.15, 0.15, 0.15); // Dark chunk border color for walls and bottom
          
          // Apply lighting to the color
          // If vHeight is super low, it's the wall/bottom.
          if (vHeight < -5.0 && ) {
            color = boxColor;
          } else {
            // Otherwise, it's the top surface.
            color = terrainColor;
          }
          
          gl_FragColor = vec4(color * lighting, 1.0);
        }
      `,
      wireframe: false,
    });
  }
}

extend({ TerrainMaterial });

export default function Terrain() {
  // UseMemo prevents the geometry from rebuilding every frame
  const geometry = useMemo(
    () => new THREE.BoxGeometry(100, 10, 100, 256, 1, 256),
    [],
  );

  // Leva Controls for terrain parameters
  const { Seed, Scale, Height, Octaves, Persistence } = useControls(
    "Terrain Settings",
    {
      Seed: { value: 735, min: 0, max: 1000, step: 1 },
      Scale: { value: 22.5, min: 1.0, max: 50.0 },
      Height: { value: 12.0, min: 1.0, max: 50.0 },
      Octaves: { value: 6, min: 1, max: 8, step: 1 },
      Persistence: { value: 0.45, min: 0.1, max: 1.0 },
    },
  );

  // Return the mesh with the custom shader material applied, passing in the uniforms for the shader
  return (
    <mesh geometry={geometry} position={[0, -5, 0]}>
      <terrainMaterial
        uniforms-uSeed-value={Seed}
        uniforms-uScale-value={Scale}
        uniforms-uHeight-value={Height}
        uniforms-uOctaves-value={Octaves}
        uniforms-uPersistence-value={Persistence}
      />
    </mesh>
  );
}
