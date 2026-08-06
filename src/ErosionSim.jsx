import React from "react";
import { useControls, button } from "leva";

export default function ErosionSim({ initialData, onReturn }) {
  // Controls will automatically mount/unmount when this component does
  const { DropCount, ErosionRate } = useControls("Erosion Settings", {
    DropCount: { value: 100000, min: 1000, max: 500000, step: 1000 },
    ErosionRate: { value: 0.1, min: 0.01, max: 1.0 },
    "Return to Generator": button(() => {
      onReturn();
    })
  });

  // temp render a basic mesh
  return (
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[100, 10, 100, 1, 1, 1]} />
      <meshStandardMaterial color="#8A7D72" wireframe={true} />
    </mesh>
  );
}