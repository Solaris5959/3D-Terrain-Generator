# 3D Terrain Generator

**[Live Demo](https://solaris5959.github.io/3D-Terrain-Generator/)**

(GIF demo of sim goes here)

A web-based 3D terrain simulator built to explore procedural generation, physical erosion algorithms, and high-performance browser rendering. The application generates mathematically driven landscapes, simulates environmental weathering, dynamically textures the surface, and updates the 3D model and its lighting in real-time.

## Technologies Used

* **Core:** React, Vite
* **Rendering:** Three.js (WebGL), Custom Shaders
* **Algorithms:** Perlin & Ridged Fractal Noise, Hydraulic & Thermal Erosion

## Technical Architecture

### Procedural Generation
Terrain heightmaps are initially generated using Perlin and Ridged Fractal noise functions, providing a foundational organic topography. The inclusion of ridged noise allows for the generation of sharper, more prominent mountain peaks. Users can dynamically adjust the base generation parameters:
- **Generation Seed**
- **Terrain Scale & Height**
- **Octaves:** Controls the number of passes of additional noise applied to the terrain. More octaves result in higher-frequency, complex details.
- **Persistence:** Determines the degree to which each successive octave affects the overall height. The amplitude of the noise decays with each pass based on this value.

### Erosion Simulation
To achieve a highly realistic, weathered landscape, the base noise map is processed through hydraulic and thermal erosion algorithms. 

The hydraulic simulation calculates the physical behavior of thousands of virtual water droplets dropped onto the terrain. As the droplets flow downhill along the calculated surface normals, they dissolve material (erosion), carry it along their path (suspension), and drop it as their velocity decreases (deposition). Users can manipulate variables such as droplet lifespan, erosion rate, and carrying capacity.

Following hydraulic weathering, a thermal erosion pass is applied to simulate the shifting of unstable debris, ensuring slopes do not exceed the material's natural angle of repose by slumping material downhill.

### Dynamic Texturing
To elevate visual fidelity, the terrain employs dynamic, algorithmic texturing based on local topology. The custom fragment shader evaluates the steepness (derived from the dynamically calculated normals) and the global height of each vertex to seamlessly blend distinct surface materials. These materials utilize color, normal, and roughness maps to accurately simulate environmental features, assigning rock textures to sheer cliffs and soil or grass to flatter plains.

### Rendering Performance
Real-time manipulation of 3D geometry is computationally intensive. To maintain consistent frame rates while updating the 3D model, the rendering pipeline offloads displacement calculations to the GPU. 

The application stores a 1-dimensional array of the mesh's vertices directly in VRAM as a buffer geometry. At render time, a custom vertex shader calculates the displacement utilizing the combined noise and erosion data, mapping each vertex to its new coordinate. 

During this vertex displacement, normal vectors are recalculated dynamically and passed to the fragment shader. The fragment shader evaluates these normals for both the procedural texturing rules and calculates the dot product against a global directional spotlight to scale the local illumination for accurate diffuse lighting.

## Technical Highlights

* **Math-to-Geometry Pipeline:** Translated complex mathematical formulas (noise matrices, fluid dynamics, and talus angles) into a scalable visual 3D environment.
* **GPU Optimization:** Avoided main-thread blocking by migrating heavy vertex manipulation and real-time lighting logic directly to custom WebGL shaders.
* **Procedural PBR Materials:** Developed algorithmic shader rules to dynamically blend base color, normal, and roughness maps based entirely on the mathematical steepness and height of the generated vertices.
* **Asset Exporting:** Implemented geometry serialization, allowing users to export the generated terrain directly from the browser as a standard `.glb` file for use in external 3D modeling software or game engines.

## Local Development

1. Clone the repository:
   ```bash
   git clone [https://github.com/Solaris5959/3D-Terrain-Generator.git](https://github.com/Solaris5959/3D-Terrain-Generator.git)
   ```

2. Navigate to the project directory:
   ```bash
   cd 3D-Terrain-Generator
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the Vite development server:
   ```bash
   npm run dev
   ```

## Deployment

This project is optimized for static hosting and deployed via GitHub Pages.