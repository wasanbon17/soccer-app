import { useState } from "react";
import { Canvas } from "@react-three/fiber";
// OrbitControls=カメラ操作, Text=3D文字, Billboard=常にカメラを向く板。
import { OrbitControls, Text, Billboard } from "@react-three/drei";
import {
  players,
  TIMES,
  type Position,
  DECOY_PLAYER_ID,
  PULLED_PLAYER_ID,
  OPEN_SPACE,
  SPACE_OPEN_TIME,
  BALL_TRACK,
} from "../data/players";
import { Arrow } from "./Arrow";
import { PitchLines } from "./PitchLines";
import "./Stadium.css";

// --- 3D空間の寸法設定 ---
const PITCH_WIDTH = 60;
const PITCH_DEPTH = 40;
const PLAYER_RADIUS = 1.5;
const BALL_RADIUS = 0.8;

const MIN_TIME = TIMES[0];
const MAX_TIME = TIMES[TIMES.length - 1];

function lerp(a: number, b: number, ratio: number): number {
  return a + (b - a) * ratio;
}

// ある時刻 t における位置(0〜100)を計算（選手にもボールにも使える）。
function positionAtTime(track: Position[], t: number): Position {
  for (let i = 0; i < TIMES.length - 1; i++) {
    const startTime = TIMES[i];
    const endTime = TIMES[i + 1];
    if (t >= startTime && t <= endTime) {
      const ratio = (t - startTime) / (endTime - startTime);
      return {
        x: lerp(track[i].x, track[i + 1].x, ratio),
        y: lerp(track[i].y, track[i + 1].y, ratio),
      };
    }
  }
  return track[track.length - 1];
}

// データ座標(0〜100) → 3Dワールド座標 [X, Y, Z]。
function toWorld(pos: Position, y: number): [number, number, number] {
  return [
    (pos.x / 100 - 0.5) * PITCH_WIDTH,
    y,
    (pos.y / 100 - 0.5) * PITCH_DEPTH,
  ];
}

function Stadium() {
  const [time, setTime] = useState(MIN_TIME);

  // 矢印用：囮 と 釣られた守備 の現在位置と最終目的地。
  const decoy = players.find((p) => p.id === DECOY_PLAYER_ID)!;
  const pulled = players.find((p) => p.id === PULLED_PLAYER_ID)!;
  const ARROW_Y = 0.3;
  const decoyFrom = toWorld(positionAtTime(decoy.track, time), ARROW_Y);
  const decoyTo = toWorld(decoy.track[decoy.track.length - 1], ARROW_Y);
  const pulledFrom = toWorld(positionAtTime(pulled.track, time), ARROW_Y);
  const pulledTo = toWorld(pulled.track[pulled.track.length - 1], ARROW_Y);

  // スポットライト演出の明るさ（0〜1）。
  const glow = Math.min(
    Math.max((time - SPACE_OPEN_TIME) / (MAX_TIME - SPACE_OPEN_TIME), 0),
    1
  );
  const spaceCenter = toWorld(OPEN_SPACE, 0);

  // ボールの現在位置。
  const ball = toWorld(positionAtTime(BALL_TRACK, time), BALL_RADIUS);

  return (
    <div>
      <div className="scene">
        <Canvas camera={{ position: [0, 45, 45], fov: 50 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[20, 40, 20]} intensity={1} />

          {/* 床（ピッチ）：ダークグレー */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[PITCH_WIDTH, PITCH_DEPTH]} />
            <meshStandardMaterial color="#333333" />
          </mesh>

          {/* 白いライン */}
          <PitchLines width={PITCH_WIDTH} depth={PITCH_DEPTH} />

          {/* スポットライト演出 */}
          <mesh
            position={[spaceCenter[0], 0.08, spaceCenter[2]]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <circleGeometry args={[7, 48]} />
            <meshStandardMaterial
              color="#fff2a8"
              emissive="#ffe066"
              emissiveIntensity={glow * 2.5}
              transparent
              opacity={glow * 0.75}
            />
          </mesh>
          <pointLight
            position={[spaceCenter[0], 12, spaceCenter[2]]}
            intensity={glow * 60}
            distance={35}
            color="#fff0b0"
          />

          {/* 選手（球）＋ 頭上の背番号 */}
          {players.map((player) => {
            const pos = positionAtTime(player.track, time);
            const [wx, , wz] = toWorld(pos, 0);
            return (
              <group key={player.id}>
                <mesh position={[wx, PLAYER_RADIUS, wz]}>
                  <sphereGeometry args={[PLAYER_RADIUS, 32, 32]} />
                  <meshStandardMaterial
                    color={player.team === "home" ? "#1e6fff" : "#e23b3b"}
                  />
                </mesh>
                {/* 背番号。Billboard で常にカメラの方を向く。 */}
                <Billboard position={[wx, PLAYER_RADIUS * 2 + 1, wz]}>
                  <Text
                    fontSize={2.2}
                    color="#ffffff"
                    outlineWidth={0.18}
                    outlineColor="#000000"
                    anchorX="center"
                    anchorY="middle"
                  >
                    {player.number}
                  </Text>
                </Billboard>
              </group>
            );
          })}

          {/* サッカーボール（白い球） */}
          <mesh position={ball}>
            <sphereGeometry args={[BALL_RADIUS, 24, 24]} />
            <meshStandardMaterial color="#ffffff" roughness={0.4} />
          </mesh>

          {/* 戦術アロー */}
          <Arrow from={decoyFrom} to={decoyTo} color="#ffd24a" />
          <Arrow from={pulledFrom} to={pulledTo} color="#46e0ff" dashed />

          <OrbitControls />
        </Canvas>
      </div>

      {/* 画面下部のシークバー */}
      <div className="seekbar">
        <span className="seekbar__label">時刻: {time}</span>
        <input
          type="range"
          min={MIN_TIME}
          max={MAX_TIME}
          value={time}
          onChange={(e) => setTime(Number(e.target.value))}
          className="seekbar__range"
        />
      </div>
    </div>
  );
}

export default Stadium;
