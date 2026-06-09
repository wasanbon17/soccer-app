// drei の Line で、床の上に白いラインを引きます。
import { Line } from "@react-three/drei";

// 床の大きさを受け取ります（Stadium 側の PITCH_WIDTH / PITCH_DEPTH と合わせます）。
type PitchLinesProps = {
  width: number; // X方向（横）の長さ
  depth: number; // Z方向（縦）の長さ
};

// 線を引く高さ（床 y=0 より少しだけ上げて、床に埋もれないように）。
const Y = 0.05;
const LINE_COLOR = "#ffffff";
const LINE_WIDTH = 2;

// 中心(0,0)を基準にした円の点列を作るヘルパー（センターサークルやスポット用）。
function circlePoints(
  radius: number,
  segments: number
): [number, number, number][] {
  const points: [number, number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push([Math.cos(angle) * radius, Y, Math.sin(angle) * radius]);
  }
  return points;
}

export function PitchLines({ width, depth }: PitchLinesProps) {
  const halfW = width / 2; // X方向の端まで
  const halfD = depth / 2; // Z方向の端まで

  // ペナルティエリア・ゴールエリア・ゴールのサイズ（実寸の比率をざっくり再現）。
  const penaltyDepth = width * 0.15; // ゴールラインからの奥行き
  const penaltyHalf = depth * 0.3; // 中央から上下への半分の幅
  const goalAreaDepth = width * 0.05;
  const goalAreaHalf = depth * 0.14;
  const goalDepth = width * 0.025; // ゴール（枠）の奥行き
  const goalHalf = depth * 0.08;
  const penaltySpotX = halfW - width * 0.1; // ペナルティスポットのX位置

  return (
    <group>
      {/* 外枠（タッチライン＋ゴールライン） */}
      <Line
        points={[
          [-halfW, Y, -halfD],
          [halfW, Y, -halfD],
          [halfW, Y, halfD],
          [-halfW, Y, halfD],
          [-halfW, Y, -halfD],
        ]}
        color={LINE_COLOR}
        lineWidth={LINE_WIDTH}
      />

      {/* ハーフウェイライン（中央の線） */}
      <Line
        points={[
          [0, Y, -halfD],
          [0, Y, halfD],
        ]}
        color={LINE_COLOR}
        lineWidth={LINE_WIDTH}
      />

      {/* センターサークル＆センタースポット */}
      <Line points={circlePoints(depth * 0.15, 48)} color={LINE_COLOR} lineWidth={LINE_WIDTH} />
      <Line points={circlePoints(0.4, 16)} color={LINE_COLOR} lineWidth={LINE_WIDTH} />

      {/* 左側：ペナルティエリア */}
      <Line
        points={[
          [-halfW, Y, -penaltyHalf],
          [-halfW + penaltyDepth, Y, -penaltyHalf],
          [-halfW + penaltyDepth, Y, penaltyHalf],
          [-halfW, Y, penaltyHalf],
        ]}
        color={LINE_COLOR}
        lineWidth={LINE_WIDTH}
      />
      {/* 左側：ゴールエリア（小さい方） */}
      <Line
        points={[
          [-halfW, Y, -goalAreaHalf],
          [-halfW + goalAreaDepth, Y, -goalAreaHalf],
          [-halfW + goalAreaDepth, Y, goalAreaHalf],
          [-halfW, Y, goalAreaHalf],
        ]}
        color={LINE_COLOR}
        lineWidth={LINE_WIDTH}
      />
      {/* 左側：ゴール（枠）とペナルティスポット */}
      <Line
        points={[
          [-halfW, Y, -goalHalf],
          [-halfW - goalDepth, Y, -goalHalf],
          [-halfW - goalDepth, Y, goalHalf],
          [-halfW, Y, goalHalf],
        ]}
        color={LINE_COLOR}
        lineWidth={LINE_WIDTH}
      />
      <Line
        points={circlePoints(0.4, 16).map(([x, y, z]) => [x - penaltySpotX, y, z])}
        color={LINE_COLOR}
        lineWidth={LINE_WIDTH}
      />

      {/* 右側：ペナルティエリア */}
      <Line
        points={[
          [halfW, Y, -penaltyHalf],
          [halfW - penaltyDepth, Y, -penaltyHalf],
          [halfW - penaltyDepth, Y, penaltyHalf],
          [halfW, Y, penaltyHalf],
        ]}
        color={LINE_COLOR}
        lineWidth={LINE_WIDTH}
      />
      {/* 右側：ゴールエリア */}
      <Line
        points={[
          [halfW, Y, -goalAreaHalf],
          [halfW - goalAreaDepth, Y, -goalAreaHalf],
          [halfW - goalAreaDepth, Y, goalAreaHalf],
          [halfW, Y, goalAreaHalf],
        ]}
        color={LINE_COLOR}
        lineWidth={LINE_WIDTH}
      />
      {/* 右側：ゴール（枠）とペナルティスポット */}
      <Line
        points={[
          [halfW, Y, -goalHalf],
          [halfW + goalDepth, Y, -goalHalf],
          [halfW + goalDepth, Y, goalHalf],
          [halfW, Y, goalHalf],
        ]}
        color={LINE_COLOR}
        lineWidth={LINE_WIDTH}
      />
      <Line
        points={circlePoints(0.4, 16).map(([x, y, z]) => [x + penaltySpotX, y, z])}
        color={LINE_COLOR}
        lineWidth={LINE_WIDTH}
      />
    </group>
  );
}
