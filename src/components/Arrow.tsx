// drei の Line で線を、three の数学クラスで矢じりの向きを計算します。
import { Line } from "@react-three/drei";
import * as THREE from "three";

// 矢印の見た目を決めるための入力（props）。
type ArrowProps = {
  from: [number, number, number]; // 始点（足元）[X, Y, Z]
  to: [number, number, number]; // 終点（進行方向の先）[X, Y, Z]
  color: string; // 線・矢じりの色
  dashed?: boolean; // true なら点線、false（既定）なら実線
};

// 3D空間に「線 + 矢じり（円錐）」で矢印を描くコンポーネント。
export function Arrow({ from, to, color, dashed = false }: ArrowProps) {
  // three のベクトルに変換して、向きと長さを計算します。
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const direction = new THREE.Vector3().subVectors(end, start); // 始点→終点のベクトル
  const length = direction.length(); // 矢印の長さ

  // ほぼ動いていない（長さが短い）ときは、矢印を描かない（見た目が乱れるのを防ぐ）。
  if (length < 1) return null;

  direction.normalize(); // 長さ1の「向きだけ」のベクトルにする

  // 円錐(コーン)は標準で上(+Y)を向いています。
  // それを direction の向きへ回転させるための回転(クォータニオン)を計算。
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction
  );

  // 矢じり(円錐)の位置。円錐は中心基準なので、先端が終点に来るよう少し手前に置く。
  const headBack = 1; // 円錐の高さの半分ぶん手前へ
  const headPos = new THREE.Vector3()
    .copy(end)
    .addScaledVector(direction, -headBack);

  return (
    <group>
      {/* 線。実線は太く、点線は少し細く描きます。 */}
      <Line
        points={[from, to]}
        color={color}
        lineWidth={dashed ? 2.5 : 4.5}
        dashed={dashed}
        dashSize={1.2}
        gapSize={0.8}
      />
      {/* 矢じり（円錐）。direction の向きに回転させて配置。 */}
      <mesh
        position={[headPos.x, headPos.y, headPos.z]}
        quaternion={[quaternion.x, quaternion.y, quaternion.z, quaternion.w]}
      >
        <coneGeometry args={[0.8, 2, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}
