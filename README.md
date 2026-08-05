# 3D Terrain Generator

**[Live Demo](https://solaris5959.github.io/3D-Terrain-Generator/)**

(GIF demo of sim goes here)

A web-based 3D terrain simulator built to explore procedural generation and high-performance browser rendering. The application generates mathematically driven landscapes and updates the 3D model and its lighting in real-time.

## Technologies Used

* **Core:** React, Vite
* **Rendering:** Three.js (WebGL), Custom Shaders
* **Algorithms:** Perlin Noise

## Technical Architecture

### Procedural Generation
Terrain heightmaps are procedurally generated using a Perlin noise function, which allows for the creation of organic, natural-looking topographies. Users can dynamically adjust the terrain generation parameters:
- **Generation Seed**
- **Terrain Scale & Height**
- **Octaves:** Controls the number of passes of additional noise applied to the terrain. More octaves result in higher-frequency, complex details.
- **Persistence:** Determines the degree to which each successive octave affects the overall height. The amplitude of the noise decays with each pass based on this value.

### Rendering Performance
Real-time manipulation of 3D geometry is computationally intensive. To maintain consistent frame rates while updating the 3D model, the rendering pipeline offloads displacement calculations to the GPU. 

The application stores a 1-dimensional array of the mesh's vertices directly in VRAM as a buffer geometry. At render time, a custom **vertex shader** calculates the displacement utilizing the Perlin noise algorithm and maps each vertex to its new coordinate. 

During this vertex displacement, normal vectors are recalculated dynamically and passed to the **fragment shader**. The fragment shader calculates the dot product of each normal vector against a global directional spotlight, scaling the local illumination to render accurate, real-time diffuse lighting.

## Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/Solaris5959/3D-Terrain-Generator.git
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