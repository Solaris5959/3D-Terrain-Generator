export const vertexShader = `
    uniform float uSeed;
    uniform float uScale;
    uniform float uHeight;
    uniform int uOctaves;
    uniform float uPersistence;
  
    varying float vHeight;
    varying vec3 vNormal;
    varying float vIsWall;
    varying float vEdgeNoise;
    varying vec2 vPosXZ;

    // --- Perlin Noise Functions ---

    // Permutation function to hash pseudo-random gradients: f(x) = (34x^2 + x) mod 289
    vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

    // 2D Perlin noise function, handles basic noise generation and interpolation between grid points
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

    // Fractal Brownian Motion (FBM) Loop, layers noise at different frequencies and amplitudes to create more complex terrain features
    float fbmSmooth(vec2 p) { // fbmSmooth
        float value = 0.0;
        float amplitude = 1.0;
        float frequency = 1.0;
        float weight = 1.0;
        
        // Loop through octaves to layer noise at different frequencies and amplitudes
        for (int i = 0; i < uOctaves; i++) {
            value += amplitude * cnoise(p * frequency + uSeed); // Samples noise function at increasing frequencies and decreasing amplitudes, adding more detail to the terrain

            frequency *= 2.0; // Double the frequency for the next octave, increases the detail of the noise
            amplitude *= uPersistence; // Each loop will have less influence on the final noise value (height)
        }
        return value;
    }

    // Fractal Brownian Motion (FBM) Loop, layers noise at different frequencies and amplitudes to create more complex terrain features
    float fbmRidged(vec2 p) { // fbmRidged
        float value = 0.0;
        float amplitude = 1.0;
        float frequency = 1.0;
        float weight = 1.0;
        
        // Loop through octaves to layer noise at different frequencies and amplitudes
        for (int i = 0; i < uOctaves; i++) {
            float n = cnoise(p * frequency + uSeed); // Sample noise function at increasing frequencies

            n = 1.0 - abs(n); // Shape the noise as ridges by inverting the absolute value of the sampled value\

            n *= n; // Sharpen the ridges

            n *= weight; // Apply weighting from the previous octave to maintain smoothness/sharpness depending on slope

            weight = clamp(n * 2.0, 0.0, 1.0); // Update weight for next octave

            value += amplitude * n; // Accumulate to final noise value

            frequency *= 2.0; // Double the frequency for the next octave, increases the detail of the noise
            amplitude *= uPersistence; // Each loop will have less influence on the final noise value (height)
        }

        return value - 1.0; // Decrease height to work with snow and tree lines
    }

    // Helper function to get the elevation of the terrain at a given point, using FBM and scaling it by the height multiplier
    float getElevation(vec2 p) {
        #ifdef USE_RIDGED
            return fbmRidged(p * (1.0 / uScale)) * uHeight;
        #else
            return fbmSmooth(p * (1.0 / uScale)) * uHeight;
        #endif
    }

    void main() {
        vec3 newPosition = position; // Start with the original vertex position, will be modified for terrain height
        vPosXZ = position.xz; // Pass local coordinates for texture tiling
        
        // Check if current vertex is part of the terrain (top face), or the bounding box
        bool isTopFace = normal.y > 0.5;
        
        // Stretch the terrain vertically based on the FBM noise function, only for the top face of the box geometry
        if (position.y > 0.0) {
            float h = getElevation(position.xz);
            newPosition.y += h; 
            vHeight = h; 

            // Calculate a secondary noise pass specifically for texture border blending
            vEdgeNoise = cnoise(position.xz * 0.15) * 4.0; // 0.15 freq, 4.0 amp
        }
        
        // Calculate normals for lighting
        if (isTopFace) {
        float h = getElevation(position.xz);  // Get the height of the terrain at the current vertex position
        float step = 0.01; 

        // Calculate the height of two adjacent vertices in the x and z directions to compute the slope of the terrain
        float hx = getElevation(position.xz + vec2(step, 0.0));
        float hz = getElevation(position.xz + vec2(0.0, step));
        
        // Calculate the tangent vectors based on the height differences in the x and z directions
        vec3 t1 = vec3(step, hx - h, 0.0); 
        vec3 t2 = vec3(0.0, hz - h, step); 
        
        // Compute normal by cross product of the tangent vectors, then transform it to world space using the model matrix for lighting 
        vec3 localNormal = normalize(cross(t2, t1));
        vNormal = normalize(mat3(modelMatrix) * localNormal);
        
        vIsWall = 0.0; // Tell the fragment shader to color this like terrain
        } else {
        vNormal = normalize(mat3(modelMatrix) * normal); // Use the original normal for the walls and bottom of the box
        
        vIsWall = 1.0; // Tell the fragment shader to color this as the bounding box
        }
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
`;

export const fragmentShader = `
    varying float vHeight;
    varying vec3 vNormal;
    varying float vIsWall;
    varying float vEdgeNoise;
    varying vec2 vPosXZ;

    uniform vec3 uLightDir;

    uniform float uSnowLine;
    uniform float uTreeLine;
    uniform float uBlendSoftness;

    // Dynamic Terrain Textures
    uniform sampler2D uGrass;
    uniform sampler2D uRock;
    uniform sampler2D uSnow;
    uniform float uTextureScale;

    float ambientLightIntensity = 0.30; // Ambient Light Intensity, affects shadows
    float diffuseLightIntensity = 1.5; // Diffuse Light Intensity, affects highlights
    
    void main() {
        // Calculate Lambertian reflectance, dot product and clamp minimum to 0.0 to get shadows
        float diffuse = max(dot(vNormal, uLightDir), 0.0);

        // Calculate final lighting amount by ambient + diffuse, adjust globals to control the overall brightness and contrast of the terrain
        float lighting = ambientLightIntensity + (diffuse * diffuseLightIntensity);
        
        vec3 finalColor;
        vec3 boxColor = vec3(0.15, 0.15, 0.15); // Dark chunk border
        
        // Apply lighting to the segments of the terrain
        if (vIsWall > 0.5) {
            finalColor = boxColor; // The walls and bottom
        } else {
            // Calculate UVs based on world position and scale
            vec2 uv = vPosXZ / uTextureScale;

            // Sample the packed textures
            vec4 grassPacked = texture2D(uGrass, uv);
            vec4 rockPacked  = texture2D(uRock, uv);
            vec4 snowPacked  = texture2D(uSnow, uv);

            // Extract the RGB color (Albedo)
            vec3 grassColor = grassPacked.rgb;
            vec3 rockColor  = rockPacked.rgb;
            vec3 snowColor  = snowPacked.rgb;

            // Extract Roughness (Alpha) - ready for PBR lighting later
            float grassRough = grassPacked.a;
            float rockRough  = rockPacked.a;
            float snowRough  = snowPacked.a;

            float noisyHeight = vHeight + vEdgeNoise;
            
            // Your existing Leva-controlled blend logic
            float treeFactor = smoothstep(uTreeLine - uBlendSoftness, uTreeLine + uBlendSoftness, noisyHeight);
            float snowFactor = smoothstep(uSnowLine - uBlendSoftness, uSnowLine + uBlendSoftness, noisyHeight);
            
            // Blend textures based on height
            finalColor = grassColor; 
            finalColor = mix(finalColor, rockColor, treeFactor); 
            finalColor = mix(finalColor, snowColor, snowFactor);
        }
        
        gl_FragColor = vec4(finalColor * lighting, 1.0);
    }
`;

export const bakedVertexShader = `
    attribute float aIsWall;

    varying float vHeight;
    varying vec3 vNormal;
    varying float vIsWall;
    varying float vEdgeNoise;
    varying vec2 vPosXZ;

    // We only need cnoise here for the texture edge blending, copied from the vertex shader above
    vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
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

    void main() {
        // Y value is baked in, just pass it to shader
        vHeight = position.y - 500.0; 
        vIsWall = aIsWall;
        vPosXZ = position.xz; // Pass local coordinates for texture tiling
        
        // Get the normal for lighting, transform it to world space using the model matrix
        vNormal = normalize(mat3(modelMatrix) * normal);
        
        // Keep edge noise for texture blending, but scale it down to avoid extreme values
        vEdgeNoise = cnoise(position.xz * 0.15) * 4.0; 

        // Set the final position of the vertex in clip space, using the model-view-projection matrix
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;