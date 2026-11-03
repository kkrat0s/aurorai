import React from 'react';
import Svg, {
  Circle,
  Defs,
  G,
  Polygon,
  RadialGradient,
  Stop,
} from 'react-native-svg';

export type DeviceOverloadState = 'ONLINE' | 'BROWNOUT' | 'BLACKOUT';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Face3D {
  verts: Vec3[];
  baseColor: [number, number, number]; // RGB 0..255
  emissive?: [number, number, number]; // Active glow RGB when ONLINE
  isCircuit?: boolean; // Glows amber/red during brownout thermal runaway, then chars in blackout
  shininess?: number; // Blinn-Phong specular exponent
  specStrength?: number; // Specular highlight intensity
}

function rotateVec3(v: Vec3, rx: number, ry: number, rz: number): Vec3 {
  const cz = Math.cos(rz);
  const sz = Math.sin(rz);
  const x1 = v.x * cz - v.y * sz;
  const y1 = v.x * sz + v.y * cz;
  const z1 = v.z;

  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const x2 = x1 * cy + z1 * sy;
  const y2 = y1;
  const z2 = -x1 * sy + z1 * cy;

  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  const y3 = y2 * cx - z2 * sx;
  const z3 = y2 * sx + z2 * cx;

  return { x: x2, y: y3, z: z3 };
}

function projectVec3(
  v: Vec3,
  cx: number,
  cy: number,
  fov = 225,
  camDist = 142
): { x: number; y: number; z: number; scale: number } {
  const depth = Math.max(35, camDist + v.z);
  const scale = fov / depth;
  return {
    x: cx + v.x * scale,
    y: cy + v.y * scale,
    z: v.z,
    scale,
  };
}

function computeNormal(v0: Vec3, v1: Vec3, v2: Vec3): Vec3 {
  const ux = v1.x - v0.x;
  const uy = v1.y - v0.y;
  const uz = v1.z - v0.z;
  const vx = v2.x - v0.x;
  const vy = v2.y - v0.y;
  const vz = v2.z - v0.z;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const len = Math.max(1e-5, Math.sqrt(nx * nx + ny * ny + nz * nz));
  return { x: nx / len, y: ny / len, z: nz / len };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g)
    .toString(16)
    .padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
}

function makeBoxFaces(
  cx: number,
  cy: number,
  cz: number,
  hx: number,
  hy: number,
  hz: number,
  baseColor: [number, number, number],
  emissive?: [number, number, number],
  isCircuit = false,
  shininess = 22,
  specStrength = 0.42
): Face3D[] {
  const p000 = { x: cx - hx, y: cy - hy, z: cz - hz };
  const p100 = { x: cx + hx, y: cy - hy, z: cz - hz };
  const p110 = { x: cx + hx, y: cy + hy, z: cz - hz };
  const p010 = { x: cx - hx, y: cy + hy, z: cz - hz };
  const p001 = { x: cx - hx, y: cy - hy, z: cz + hz };
  const p101 = { x: cx + hx, y: cy - hy, z: cz + hz };
  const p111 = { x: cx + hx, y: cy + hy, z: cz + hz };
  const p011 = { x: cx - hx, y: cy + hy, z: cz + hz };

  return [
    { verts: [p001, p101, p111, p011], baseColor, emissive, isCircuit, shininess, specStrength }, // Front
    { verts: [p100, p000, p010, p110], baseColor, emissive, isCircuit, shininess, specStrength }, // Back
    { verts: [p000, p100, p101, p001], baseColor, emissive, isCircuit, shininess, specStrength }, // Top
    { verts: [p011, p111, p110, p010], baseColor, emissive, isCircuit, shininess, specStrength }, // Bottom
    { verts: [p101, p100, p110, p111], baseColor, emissive, isCircuit, shininess, specStrength }, // Right
    { verts: [p000, p001, p011, p010], baseColor, emissive, isCircuit, shininess, specStrength }, // Left
  ];
}

function makeCylinderZ(
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  halfDepth: number,
  segs: number,
  sideColor: [number, number, number],
  capColor: [number, number, number],
  emissive?: [number, number, number],
  isCircuit = false
): Face3D[] {
  const faces: Face3D[] = [];
  const frontRing: Vec3[] = [];
  const backRing: Vec3[] = [];

  for (let i = 0; i < segs; i++) {
    const a1 = (i / segs) * Math.PI * 2;
    const a2 = ((i + 1) / segs) * Math.PI * 2;
    const x1 = cx + Math.cos(a1) * radius;
    const y1 = cy + Math.sin(a1) * radius;
    const x2 = cx + Math.cos(a2) * radius;
    const y2 = cy + Math.sin(a2) * radius;

    const f1 = { x: x1, y: y1, z: cz + halfDepth };
    const f2 = { x: x2, y: y2, z: cz + halfDepth };
    const b1 = { x: x1, y: y1, z: cz - halfDepth };
    const b2 = { x: x2, y: y2, z: cz - halfDepth };

    frontRing.push(f1);
    backRing.unshift(b1);

    faces.push({
      verts: [f1, f2, b2, b1],
      baseColor: sideColor,
      emissive,
      isCircuit,
      shininess: 18,
      specStrength: 0.35,
    });
  }

  faces.push(
    { verts: frontRing, baseColor: capColor, emissive, isCircuit, shininess: 28, specStrength: 0.5 },
    { verts: backRing, baseColor: capColor, emissive, isCircuit, shininess: 28, specStrength: 0.5 }
  );
  return faces;
}

// ============================================================================
// 1. 3D SATELLITE MESH (Octagonal Gold MLI Bus, 12-Seg Dish, Solar Array Wings)
// ============================================================================
const SATELLITE_MESH: { faces: Face3D[]; arcNodes: Vec3[] } = (() => {
  const faces: Face3D[] = [];

  const busSegs = 8;
  const busR = 11.5;
  const busHalfH = 12;
  const topCap: Vec3[] = [];
  const botCap: Vec3[] = [];
  for (let i = 0; i < busSegs; i++) {
    const a1 = (i / busSegs) * Math.PI * 2 + Math.PI / 8;
    const a2 = ((i + 1) / busSegs) * Math.PI * 2 + Math.PI / 8;
    const x1 = Math.cos(a1) * busR;
    const z1 = Math.sin(a1) * busR;
    const x2 = Math.cos(a2) * busR;
    const z2 = Math.sin(a2) * busR;

    const t1 = { x: x1, y: -busHalfH, z: z1 };
    const t2 = { x: x2, y: -busHalfH, z: z2 };
    const b1 = { x: x1, y: busHalfH, z: z1 };
    const b2 = { x: x2, y: busHalfH, z: z2 };
    topCap.push(t1);
    botCap.unshift(b1);

    faces.push({
      verts: [t1, t2, b2, b1],
      baseColor: i % 2 === 0 ? [225, 178, 62] : [198, 148, 42],
      shininess: 36,
      specStrength: 0.65,
    });
  }
  faces.push(
    { verts: topCap, baseColor: [180, 195, 212], shininess: 28, specStrength: 0.5 },
    { verts: botCap, baseColor: [140, 155, 175], shininess: 24, specStrength: 0.4 }
  );

  faces.push(
    ...makeBoxFaces(0, -14.5, 0, 6.8, 2.5, 6.8, [90, 130, 170], [0, 225, 255], true, 32, 0.55)
  );

  // 10-Segment 3D Concave Parabolic High-Gain Dish on front (+Z)
  const dishSegs = 10;
  const dishOuterR = 13.2;
  const dishApexZ = 12.2;
  for (let i = 0; i < dishSegs; i++) {
    const a1 = (i / dishSegs) * Math.PI * 2;
    const a2 = ((i + 1) / dishSegs) * Math.PI * 2;
    const apex: Vec3 = { x: 0, y: 0, z: dishApexZ };
    const rim1: Vec3 = {
      x: Math.cos(a1) * dishOuterR,
      y: Math.sin(a1) * dishOuterR,
      z: dishApexZ + 6.0,
    };
    const rim2: Vec3 = {
      x: Math.cos(a2) * dishOuterR,
      y: Math.sin(a2) * dishOuterR,
      z: dishApexZ + 6.0,
    };

    faces.push({
      verts: [apex, rim1, rim2],
      baseColor: i % 2 === 0 ? [228, 236, 246] : [196, 210, 226],
      shininess: 34,
      specStrength: 0.6,
    });
  }
  faces.push(
    ...makeBoxFaces(0, 0, dishApexZ + 8.2, 2.0, 2.0, 4.0, [245, 195, 75], [56, 235, 190], true, 38, 0.6)
  );

  // Left & Right 3D Multi-Panel Solar Array Wings (3 articulated panels per wing)
  for (const side of [-1, 1]) {
    faces.push(...makeBoxFaces(side * 25, 0, 0, 14, 0.9, 0.9, [175, 190, 208]));
    for (let p = 0; p < 3; p++) {
      const px = side * (20 + p * 11.5);
      faces.push(
        ...makeBoxFaces(
          px,
          0,
          0,
          5.0,
          11.2,
          0.7,
          [22, 85, 175],
          [0, 195, 255],
          true,
          42,
          0.72
        )
      );
    }
  }

  return {
    faces,
    arcNodes: [
      { x: -24, y: -3, z: 2 },
      { x: 24, y: 3, z: 2 },
      { x: 0, y: -13, z: 6 },
      { x: 0, y: 1, z: 18 },
    ],
  };
})();

// ============================================================================
// 2. 3D AUTONOMOUS ELECTRIC CAR MESH (Sculpted Aero Body, LiDAR, 3D Round Wheels)
// ============================================================================
const CAR_MESH: { faces: Face3D[]; arcNodes: Vec3[] } = (() => {
  const faces: Face3D[] = [];

  faces.push(...makeBoxFaces(0, 6.2, 0, 33, 3.8, 14.8, [78, 92, 114], undefined, false, 30, 0.5));

  const hfl = { x: -33, y: 3.5, z: 14.2 };
  const hfr = { x: -33, y: 3.5, z: -14.2 };
  const hbl = { x: -13, y: 0.8, z: 14.5 };
  const hbr = { x: -13, y: 0.8, z: -14.5 };
  faces.push(
    { verts: [hfl, hfr, hbr, hbl], baseColor: [108, 126, 152], shininess: 38, specStrength: 0.65 }
  );

  faces.push(
    ...makeBoxFaces(0, 4.8, 0, 19, 2.6, 12.2, [18, 175, 160], [0, 245, 220], true, 34, 0.55)
  );

  const cfl = { x: -14, y: 1.2, z: 13.2 };
  const cfr = { x: -14, y: 1.2, z: -13.2 };
  const crl = { x: 22, y: 1.2, z: 12.8 };
  const crr = { x: 22, y: 1.2, z: -12.8 };
  const tfl = { x: -3, y: -8.8, z: 9.8 };
  const tfr = { x: -3, y: -8.8, z: -9.8 };
  const trl = { x: 12, y: -8.2, z: 9.4 };
  const trr = { x: 12, y: -8.2, z: -9.4 };

  faces.push(
    { verts: [tfl, tfr, trr, trl], baseColor: [115, 132, 158], shininess: 38, specStrength: 0.6 },
    {
      verts: [cfl, cfr, tfr, tfl],
      baseColor: [32, 130, 180],
      emissive: [0, 220, 255],
      isCircuit: true,
      shininess: 45,
      specStrength: 0.75,
    },
    {
      verts: [trl, trr, crr, crl],
      baseColor: [30, 105, 150],
      emissive: [0, 185, 230],
      isCircuit: true,
      shininess: 42,
      specStrength: 0.7,
    },
    {
      verts: [cfl, tfl, trl, crl],
      baseColor: [38, 122, 168],
      emissive: [0, 200, 245],
      isCircuit: true,
      shininess: 40,
      specStrength: 0.68,
    },
    {
      verts: [cfr, crr, trr, tfr],
      baseColor: [38, 122, 168],
      emissive: [0, 200, 245],
      isCircuit: true,
      shininess: 40,
      specStrength: 0.68,
    }
  );

  faces.push(
    ...makeBoxFaces(-1, -10.2, 0, 3.2, 1.4, 3.2, [45, 200, 185], [56, 245, 210], true, 36, 0.6),
    ...makeBoxFaces(-33.5, 4.6, 0, 1.1, 1.5, 13.6, [150, 250, 255], [0, 255, 240], true, 40, 0.7),
    ...makeBoxFaces(33.2, 4.2, 0, 1.1, 1.6, 13.4, [255, 75, 105], [255, 50, 85], true, 40, 0.7)
  );

  // 4 Cylindrical 8-Sided 3D Wheels
  for (const wx of [-20.5, 20.5]) {
    for (const wz of [-15.8, 15.8]) {
      faces.push(
        ...makeCylinderZ(wx, 9.8, wz, 6.8, 2.5, 8, [34, 40, 50], [90, 195, 220], [0, 225, 255], true)
      );
    }
  }

  return {
    faces,
    arcNodes: [
      { x: -1, y: -10.5, z: 0 },
      { x: -16, y: 2.5, z: 5 },
      { x: -31, y: 4.5, z: 9 },
      { x: 2, y: 4, z: -7 },
    ],
  };
})();

// ============================================================================
// 3. 3D SMARTPHONE MESH (Titanium Chassis, Inductive Coil, 3D SoC & Camera)
// ============================================================================
const SMARTPHONE_MESH: { faces: Face3D[]; arcNodes: Vec3[] } = (() => {
  const faces: Face3D[] = [];

  faces.push(
    ...makeBoxFaces(0, 0, -2.6, 17.5, 32, 2.2, [102, 118, 142], undefined, false, 36, 0.62),
    ...makeBoxFaces(0, 0, 0.1, 15.8, 29.8, 0.6, [16, 34, 62], undefined, false, 45, 0.75),
    ...makeBoxFaces(0, -25.5, 0.9, 5.2, 1.4, 0.4, [8, 16, 30], [0, 190, 255], true)
  );

  // 8-Segment 3D Gold/Copper MagSafe Inductive Coil Ring
  const coilSegs = 8;
  const coilR = 9.2;
  for (let i = 0; i < coilSegs; i++) {
    const a = (i / coilSegs) * Math.PI * 2;
    faces.push(
      ...makeBoxFaces(
        Math.cos(a) * coilR,
        Math.sin(a) * coilR + 2,
        1.1,
        2.0,
        2.0,
        0.55,
        [232, 178, 62],
        [255, 205, 75],
        true,
        34,
        0.55
      )
    );
  }

  // Raised 3D Central Neural Engine SoC Package & Subsystems
  faces.push(
    ...makeBoxFaces(0, 2, 1.8, 5.4, 5.4, 1.3, [28, 195, 220], [0, 250, 255], true, 40, 0.7),
    ...makeBoxFaces(-7.5, -17.5, 1.5, 5.2, 6.2, 1.2, [46, 64, 92], [0, 210, 255], true, 36, 0.6),
    ...makeBoxFaces(6.2, -16.5, 1.4, 5.8, 4.5, 1.1, [32, 201, 151], [56, 240, 185], true, 36, 0.6),
    ...makeBoxFaces(-6.2, 18.5, 1.4, 5.2, 4.8, 1.1, [145, 110, 255], [175, 135, 255], true, 36, 0.6),
    ...makeBoxFaces(6.2, 18.5, 1.4, 5.2, 4.8, 1.1, [38, 175, 235], [0, 225, 255], true, 36, 0.6)
  );

  return {
    faces,
    arcNodes: [
      { x: 0, y: 2, z: 3.2 },
      { x: -7.5, y: -17, z: 2.8 },
      { x: 6, y: -16, z: 2.6 },
      { x: -6, y: 18, z: 2.6 },
    ],
  };
})();

// ============================================================================
// 4. 3D AI MICROPROCESSOR MESH (Fast 60fps CoWoS Substrate, 4 Tensor Cores, 2 HBM Banks, 20 3D Quad Pins)
// ============================================================================
const MICROPROCESSOR_MESH: { faces: Face3D[]; arcNodes: Vec3[] } = (() => {
  const faces: Face3D[] = [];

  // 3D Multi-Layer Organic Package Substrate
  faces.push(
    ...makeBoxFaces(0, 4.2, 0, 26, 3.0, 26, [28, 62, 74], undefined, false, 28, 0.45)
  );

  // Brushed Nickel-Gold Heatspreader Frame & Silicon Interposer
  faces.push(
    ...makeBoxFaces(0, 0.6, 0, 22, 0.9, 22, [218, 174, 62], undefined, false, 38, 0.65),
    ...makeBoxFaces(0, -0.8, 0, 18.5, 1.2, 18.5, [58, 86, 128], undefined, false, 34, 0.55)
  );

  // 4 Raised 3D AI Tensor Compute Quadrants
  for (const cx of [-4.6, 4.6]) {
    for (const cz of [-6.2, 6.2]) {
      faces.push(
        ...makeBoxFaces(
          cx,
          -3.4,
          cz,
          3.8,
          1.6,
          5.2,
          [32, 195, 235],
          [56, 245, 255],
          true,
          44,
          0.75
        )
      );
    }
  }

  // Left & Right 3D HBM3e High-Bandwidth Memory Stacks
  for (const side of [-13.0, 13.0]) {
    faces.push(
      ...makeBoxFaces(
        side,
        -3.1,
        -5.8,
        2.9,
        1.4,
        5.0,
        [38, 205, 165],
        [56, 235, 185],
        true,
        40,
        0.68
      ),
      ...makeBoxFaces(
        side,
        -3.1,
        5.8,
        2.9,
        1.4,
        5.0,
        [38, 205, 165],
        [56, 235, 185],
        true,
        40,
        0.68
      )
    );
  }

  // 20 3D Gold Gull-Wing Contact Pins rendered as fast 3D angled quads (instead of 168 box faces!)
  for (const offset of [-16, -8, 0, 8, 16]) {
    // Left & Right angled 3D gold pins
    faces.push(
      {
        verts: [
          { x: -26, y: 4.2, z: offset - 1.6 },
          { x: -31, y: 6.8, z: offset - 1.6 },
          { x: -31, y: 6.8, z: offset + 1.6 },
          { x: -26, y: 4.2, z: offset + 1.6 },
        ],
        baseColor: [238, 192, 68],
        emissive: [255, 215, 85],
        isCircuit: true,
        shininess: 36,
        specStrength: 0.65,
      },
      {
        verts: [
          { x: 26, y: 4.2, z: offset - 1.6 },
          { x: 31, y: 6.8, z: offset - 1.6 },
          { x: 31, y: 6.8, z: offset + 1.6 },
          { x: 26, y: 4.2, z: offset + 1.6 },
        ],
        baseColor: [238, 192, 68],
        emissive: [255, 215, 85],
        isCircuit: true,
        shininess: 36,
        specStrength: 0.65,
      },
      // Front & Back angled 3D gold pins
      {
        verts: [
          { x: offset - 1.6, y: 4.2, z: -26 },
          { x: offset - 1.6, y: 6.8, z: -31 },
          { x: offset + 1.6, y: 6.8, z: -31 },
          { x: offset + 1.6, y: 4.2, z: -26 },
        ],
        baseColor: [238, 192, 68],
        emissive: [255, 215, 85],
        isCircuit: true,
        shininess: 36,
        specStrength: 0.65,
      },
      {
        verts: [
          { x: offset - 1.6, y: 4.2, z: 26 },
          { x: offset - 1.6, y: 6.8, z: 31 },
          { x: offset + 1.6, y: 6.8, z: 31 },
          { x: offset + 1.6, y: 4.2, z: 26 },
        ],
        baseColor: [238, 192, 68],
        emissive: [255, 215, 85],
        isCircuit: true,
        shininess: 36,
        specStrength: 0.65,
      }
    );
  }

  return {
    faces,
    arcNodes: [
      { x: -4.6, y: -4.8, z: -5 },
      { x: 4.6, y: -4.8, z: 5 },
      { x: -13.0, y: -4.4, z: 0 },
      { x: 13.0, y: -4.4, z: 0 },
    ],
  };
})();

export const MESH_REGISTRY = {
  sat: SATELLITE_MESH,
  car: CAR_MESH,
  phone: SMARTPHONE_MESH,
  chip: MICROPROCESSOR_MESH,
} as const;

export const Interactive3DDeviceInsert = React.memo(function Interactive3DDeviceInsert({
  deviceId,
  state,
  animClock,
  stateElapsedSec,
  width = 148,
  height = 108,
}: {
  deviceId: keyof typeof MESH_REGISTRY;
  state: DeviceOverloadState;
  animClock: number;
  stateElapsedSec: number;
  width?: number;
  height?: number;
}) {
  const mesh = MESH_REGISTRY[deviceId];
  const W = 160;
  const H = 120;
  const cx = W / 2;
  const cy = H / 2 + 4;

  const spinSpeed = state === 'BLACKOUT' ? 0.16 : 0.82;
  const rx =
    deviceId === 'phone'
      ? -0.52 + Math.sin(animClock * 0.7) * 0.12
      : 0.5 + Math.sin(animClock * 0.55) * 0.09;
  const ry = animClock * spinSpeed + (deviceId === 'car' ? 0.65 : -0.45);
  const rz = state === 'BROWNOUT' ? Math.sin(animClock * 42) * 0.075 : 0.08;

  const lightDir: Vec3 = { x: -0.45, y: -0.62, z: 0.64 };
  const halfVec: Vec3 = { x: -0.25, y: -0.35, z: 0.90 };

  const brownoutFlicker =
    state === 'ONLINE'
      ? 1.0
      : state === 'BROWNOUT'
        ? Math.max(0.08, 0.52 + 0.48 * Math.sin(animClock * 42) * Math.cos(animClock * 19))
        : 0.0;

  const projectedFaces = mesh.faces.map((f) => {
    const rVerts = f.verts.map((v) => rotateVec3(v, rx, ry, rz));
    const pVerts = rVerts.map((v) => projectVec3(v, cx, cy));
    const zAvg = rVerts.reduce((acc, v) => acc + v.z, 0) / rVerts.length;

    const normal = computeNormal(rVerts[0], rVerts[1], rVerts[2]);
    const ndotl = Math.abs(
      normal.x * lightDir.x + normal.y * lightDir.y + normal.z * lightDir.z
    );
    const lambert = 0.22 + 0.78 * ndotl;

    const ndoth = Math.max(
      0,
      Math.abs(normal.x * halfVec.x + normal.y * halfVec.y + normal.z * halfVec.z)
    );
    const spec =
      Math.pow(ndoth, f.shininess ?? 22) *
      (f.specStrength ?? 0.4) *
      (state === 'BLACKOUT' ? 0.15 : 1.0);

    let r = f.baseColor[0] * lambert + 255 * spec;
    let g = f.baseColor[1] * lambert + 255 * spec;
    let b = f.baseColor[2] * lambert + 255 * spec;

    if (state === 'ONLINE' && f.emissive) {
      r = r * 0.42 + f.emissive[0] * 0.68 + 180 * spec;
      g = g * 0.42 + f.emissive[1] * 0.68 + 220 * spec;
      b = b * 0.42 + f.emissive[2] * 0.68 + 255 * spec;
    } else if (state === 'BROWNOUT') {
      if (f.isCircuit) {
        r = 255 * brownoutFlicker + 95 * (1 - brownoutFlicker);
        g = 135 * brownoutFlicker + 28 * (1 - brownoutFlicker);
        b = 25 * brownoutFlicker;
      } else {
        r = r * (0.55 + 0.45 * brownoutFlicker) + 52 * brownoutFlicker;
        g = g * (0.45 + 0.35 * brownoutFlicker) + 18 * brownoutFlicker;
        b = b * 0.35;
      }
    } else if (state === 'BLACKOUT') {
      const charFactor = f.isCircuit ? 0.18 : 0.34;
      r *= charFactor;
      g *= charFactor;
      b *= charFactor * 1.06;
    }

    const fillHex = rgbToHex(r, g, b);
    const strokeHex =
      state === 'ONLINE' && f.isCircuit
        ? '#88f9ff'
        : state === 'BROWNOUT' && f.isCircuit
          ? '#ffe066'
          : rgbToHex(r * 1.18, g * 1.18, b * 1.22);

    const points = pVerts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    return {
      points,
      zAvg,
      fillHex,
      strokeHex,
    };
  });

  projectedFaces.sort((a, b) => b.zAvg - a.zAvg);

  const projectedNodes = mesh.arcNodes.map((n) => {
    const rn = rotateVec3(n, rx, ry, rz);
    return projectVec3(rn, cx, cy);
  });

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <RadialGradient id={`amb-${deviceId}`} cx="50%" cy="52%" r="50%">
          <Stop
            offset="0%"
            stopColor={
              state === 'ONLINE'
                ? '#00e5ff'
                : state === 'BROWNOUT'
                  ? '#ff9100'
                  : '#ff3d00'
            }
            stopOpacity={state === 'ONLINE' ? '0.26' : state === 'BROWNOUT' ? '0.48' : '0.14'}
          />
          <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </RadialGradient>

        <RadialGradient id={`arcFlash-${deviceId}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <Stop offset="26%" stopColor="#fff59d" stopOpacity="0.95" />
          <Stop offset="58%" stopColor="#ff6d00" stopOpacity="0.62" />
          <Stop offset="100%" stopColor="#ff1744" stopOpacity="0" />
        </RadialGradient>

        <RadialGradient id={`sparkDrop-${deviceId}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <Stop offset="40%" stopColor="#ffd54f" stopOpacity="0.88" />
          <Stop offset="100%" stopColor="#ff6d00" stopOpacity="0" />
        </RadialGradient>

        <RadialGradient id={`smoke3d-${deviceId}`} cx="45%" cy="45%" r="50%">
          <Stop offset="0%" stopColor="#c2ccd8" stopOpacity="0.58" />
          <Stop offset="50%" stopColor="#636e7b" stopOpacity="0.32" />
          <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Circle cx={cx} cy={cy} r={60} fill={`url(#amb-${deviceId})`} />

      {projectedFaces.map((pf, idx) => (
        <Polygon
          key={idx}
          points={pf.points}
          fill={pf.fillHex}
          stroke={pf.strokeHex}
          strokeWidth="0.55"
          strokeLinejoin="round"
        />
      ))}

      {state === 'BROWNOUT' ? (
        <G>
          {projectedNodes.map((node, nIdx) => {
            const pulse = Math.sin(animClock * 32 + nIdx * 1.9);
            if (pulse < -0.15) return null;
            const flashR = (10 + Math.max(0, pulse) * 14) * node.scale;

            const sparks: Array<{ sx: number; sy: number; r: number; op: number }> = [];
            for (let s = 0; s < 5; s++) {
              const tSpark = (animClock * 2.8 + nIdx * 0.27 + s * 0.2) % 1;
              const angle = s * 1.25 + nIdx * 1.4;
              const speed = 22 + (s % 3) * 11;
              const vx = Math.cos(angle) * speed;
              const vy = -22 + Math.sin(angle) * 14;
              const gravity = 78;
              const sx = node.x + vx * tSpark;
              const sy = node.y + vy * tSpark + 0.5 * gravity * tSpark * tSpark;
              sparks.push({
                sx,
                sy,
                r: Math.max(1.2, (1 - tSpark * 0.75) * 4.2),
                op: Math.sin(tSpark * Math.PI),
              });
            }

            return (
              <G key={`node-${nIdx}`}>
                <Circle
                  cx={node.x}
                  cy={node.y}
                  r={flashR}
                  fill={`url(#arcFlash-${deviceId})`}
                />
                <Circle cx={node.x} cy={node.y} r={Math.max(1.8, flashR * 0.24)} fill="#ffffff" />
                {sparks.map((sp, sIdx) => (
                  <G key={sIdx} opacity={sp.op}>
                    <Circle
                      cx={sp.sx}
                      cy={sp.sy}
                      r={sp.r}
                      fill={`url(#sparkDrop-${deviceId})`}
                    />
                    <Circle cx={sp.sx} cy={sp.sy} r={sp.r * 0.32} fill="#ffffff" />
                  </G>
                ))}
              </G>
            );
          })}
        </G>
      ) : null}

      {state === 'BLACKOUT' ? (
        <G>
          {projectedNodes.slice(0, 2).map((node, nIdx) => {
            const puffs: Array<{ px: number; py: number; r: number; op: number }> = [];
            for (let p = 0; p < 4; p++) {
              const cycle = (stateElapsedSec * 0.46 + p * 0.25 + nIdx * 0.14) % 1;
              const driftX = Math.sin(cycle * Math.PI * 2 + p + nIdx) * (6 + cycle * 12);
              const px = node.x + driftX;
              const py = node.y - cycle * 54;
              const r = 8 + cycle * 20;
              const op = Math.sin(cycle * Math.PI) * 0.64;
              puffs.push({ px, py, r, op });
            }
            return (
              <G key={`smoke-${nIdx}`}>
                <Circle
                  cx={node.x}
                  cy={node.y}
                  r={5.0}
                  fill="#ff3d00"
                  opacity={0.48 + 0.22 * Math.sin(animClock * 6 + nIdx)}
                />
                {puffs.map((pf, pIdx) => (
                  <Circle
                    key={pIdx}
                    cx={pf.px}
                    cy={pf.py}
                    r={pf.r}
                    fill={`url(#smoke3d-${deviceId})`}
                    opacity={pf.op}
                  />
                ))}
              </G>
            );
          })}
        </G>
      ) : null}
    </Svg>
  );
});
