import * as THREE from "three";

export function buildTerrainGeometry(size, boxHeight, segments) {
  const halfSize = size / 2;
  const topY = boxHeight / 2;
  const bottomY = -boxHeight / 2;
  const res = segments + 1;

  // Pre-calc array sizes (saves memory)
  const numTopVertices = res * res;
  const numBottomVertices = 4;
  const numWallVertices = res * 2 * 4;
  const totalVertices = numTopVertices + numBottomVertices + numWallVertices;

  const numTopIndices = segments * segments * 6;
  const numBottomIndices = 6;
  const numWallIndices = segments * 6 * 4;
  const totalIndices = numTopIndices + numBottomIndices + numWallIndices;

  // Alloc contiguous memory blocks
  const positions = new Float32Array(totalVertices * 3);
  const normals = new Float32Array(totalVertices * 3);

  const indices = new Uint32Array(totalIndices);

  let vIdx = 0;
  let iIdx = 0;

  const addVertex = (x, y, z, nx, ny, nz) => {
    positions[vIdx * 3] = x;
    positions[vIdx * 3 + 1] = y;
    positions[vIdx * 3 + 2] = z;
    normals[vIdx * 3] = nx;
    normals[vIdx * 3 + 1] = ny;
    normals[vIdx * 3 + 2] = nz;
    return vIdx++;
  };

  // Top face, full resolution
  const topOffset = vIdx;
  for (let z = 0; z < res; z++) {
    for (let x = 0; x < res; x++) {
      const px = (x / segments) * size - halfSize;
      const pz = (z / segments) * size - halfSize;
      addVertex(px, topY, pz, 0, 1, 0);
    }
  }
  for (let z = 0; z < segments; z++) {
    for (let x = 0; x < segments; x++) {
      const a = topOffset + x + res * z;
      const b = topOffset + x + res * (z + 1);
      const c = topOffset + (x + 1) + res * (z + 1);
      const d = topOffset + (x + 1) + res * z;
      indices[iIdx++] = a;
      indices[iIdx++] = b;
      indices[iIdx++] = d;
      indices[iIdx++] = b;
      indices[iIdx++] = c;
      indices[iIdx++] = d;
    }
  }

  // Bottom face, low res
  const bottomOffset = vIdx;
  addVertex(-halfSize, bottomY, halfSize, 0, -1, 0);
  addVertex(halfSize, bottomY, halfSize, 0, -1, 0);
  addVertex(-halfSize, bottomY, -halfSize, 0, -1, 0);
  addVertex(halfSize, bottomY, -halfSize, 0, -1, 0);
  indices[iIdx++] = bottomOffset;
  indices[iIdx++] = bottomOffset + 1;
  indices[iIdx++] = bottomOffset + 2;
  indices[iIdx++] = bottomOffset + 1;
  indices[iIdx++] = bottomOffset + 3;
  indices[iIdx++] = bottomOffset + 2;

  // Wall faces, snapped to top grid
  const buildWall = (isX, isPositive, nx, ny, nz) => {
    const wallOffset = vIdx;
    for (let i = 0; i < res; i++) {
      const p = (i / segments) * size - halfSize;
      const px = isX ? (isPositive ? halfSize : -halfSize) : p;
      const pz = isX ? p : isPositive ? halfSize : -halfSize;

      addVertex(px, topY, pz, nx, ny, nz);
      addVertex(px, bottomY, pz, nx, ny, nz);
    }

    const needsABD = (!isX && isPositive) || (isX && !isPositive);
    for (let i = 0; i < segments; i++) {
      const a = wallOffset + i * 2;
      const b = wallOffset + i * 2 + 1;
      const c = wallOffset + i * 2 + 3;
      const d = wallOffset + i * 2 + 2;

      if (needsABD) {
        indices[iIdx++] = a;
        indices[iIdx++] = b;
        indices[iIdx++] = d;
        indices[iIdx++] = b;
        indices[iIdx++] = c;
        indices[iIdx++] = d;
      } else {
        indices[iIdx++] = a;
        indices[iIdx++] = d;
        indices[iIdx++] = b;
        indices[iIdx++] = b;
        indices[iIdx++] = d;
        indices[iIdx++] = c;
      }
    }
  };

  buildWall(false, true, 0, 0, 1); // Front (+Z)
  buildWall(false, false, 0, 0, -1); // Back (-Z)
  buildWall(true, true, 1, 0, 0); // Right (+X)
  buildWall(true, false, -1, 0, 0); // Left (-X)

  // Assemble the geometry
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));

  const MAX_INDICES_PER_DRAW = 15000000;
  for (let i = 0; i < totalIndices; i += MAX_INDICES_PER_DRAW) {
    const count = Math.min(MAX_INDICES_PER_DRAW, totalIndices - i);
    // addGroup(startIndex, count, materialIndex)
    geometry.addGroup(i, count, 0);
  }

  return geometry;
}
