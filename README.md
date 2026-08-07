# 3D Terrain Generator

**[Live Demo](https://solaris5959.github.io/3D-Terrain-Generator/)**

(GIF demo of sim goes here)

A web-based 3D terrain simulator built to explore procedural generation, hydraulic erosion algorithms, and high-performance browser rendering. The application generates mathematically driven landscapes, simulates physical weathering, and updates the 3D model and its lighting in real-time.

## Technologies Used

* **Core:** React, Vite
* **Rendering:** Three.js (WebGL), Custom Shaders
* **Algorithms:** Perlin Noise, Particle-Based Hydraulic Erosion Simulation

## Technical Architecture

### Procedural Generation
Terrain heightmaps are initially generated using a Perlin noise function, providing a foundational organic topography. Users can dynamically adjust the base generation parameters:
- **Generation Seed**
- **Terrain Scale & Height**
- **Octaves:** Controls the number of passes of additional noise applied to the terrain. More octaves result in higher-frequency, complex details.
- **Persistence:** Determines the degree to which each successive octave affects the overall height. The amplitude of the noise decays with each pass based on this value.

### Erosion Simulation
To achieve a highly realistic, weathered landscape, the base noise map is processed through a hydraulic erosion algorithm. This simulation calculates the physical behavior of thousands of virtual water droplets dropped onto the terrain. 
As the droplets flow downhill along the calculated surface normals, they dissolve material (erosion), carry it along their path (suspension), and drop it as their velocity decreases (deposition). Users can manipulate variables such as droplet lifespan, erosion rate, and carrying capacity to sculpt the final output.

### Rendering Performance
Real-time manipulation of 3D geometry is computationally intensive. To maintain consistent frame rates while updating the 3D model, the rendering pipeline offloads displacement calculations to the GPU. 

The application stores a 1-dimensional array of the mesh's vertices directly in VRAM as a buffer geometry. At render time, a custom vertex shader calculates the displacement utilizing the combined Perlin noise and erosion data, mapping each vertex to its new coordinate. 

During this vertex displacement, normal vectors are recalculated dynamically and passed to the fragment shader. The fragment shader calculates the dot product of each normal vector against a global directional spotlight, scaling the local illumination to render accurate, real-time diffuse lighting.

## Technical Highlights

* **Math-to-Geometry Pipeline:** Translated complex mathematical formulas (noise matrices and fluid dynamics) into a scalable visual 3D environment.
* **GPU Optimization:** Avoided main-thread blocking by migrating heavy vertex manipulation and real-time lighting logic directly to custom WebGL shaders.
* **Reactive State Management:** Bridged React's stateful UI with the Three.js rendering loop, ensuring immediate, lag-free visual feedback when users adjust complex simulation parameters.

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