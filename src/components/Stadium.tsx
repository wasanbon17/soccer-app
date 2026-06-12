import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
// OrbitControls=カメラ操作, Text=3D文字, Billboard=常にカメラを向く板。
import { OrbitControls, Text, Billboard, Html } from "@react-three/drei";
import { TEAMS, buildMatch, TIMES, type Position } from "../data/players";
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
  const [homeKey, setHomeKey] = useState(TEAMS[0].key); // ホーム（攻撃側）
  const [awayKey, setAwayKey] = useState(TEAMS[1].key); // アウェイ（守備側）
  const [time, setTime] = useState(MIN_TIME);
  const [showReport, setShowReport] = useState(true); // サイドパネルの開閉
  const [reportTab, setReportTab] = useState<"scout" | "lineup">("scout"); // レポート / スタメン表
  const [hoveredId, setHoveredId] = useState<number | null>(null); // ホバー中の選手

  // 選んだ2チームから試合データを組み立てる（チーム変更時だけ再計算）。
  const match = useMemo(() => buildMatch(homeKey, awayKey), [homeKey, awayKey]);
  const {
    players,
    decoyId,
    pulledId,
    openSpace,
    spaceOpenTime,
    ballTrack,
    explanations,
  } = match;

  // 上部プルダウンで選んだチーム（対戦カード・レポート表示に使う）。
  const homeTeam = match.home; // ホーム（攻撃）
  const awayTeam = match.away; // アウェイ（守備）

  // 矢印用：囮 と 釣られた守備 の現在位置と最終目的地。
  const decoy = players.find((p) => p.id === decoyId)!;
  const pulled = players.find((p) => p.id === pulledId)!;
  const ARROW_Y = 0.3;
  const decoyFrom = toWorld(positionAtTime(decoy.track, time), ARROW_Y);
  const decoyTo = toWorld(decoy.track[decoy.track.length - 1], ARROW_Y);
  const pulledFrom = toWorld(positionAtTime(pulled.track, time), ARROW_Y);
  const pulledTo = toWorld(pulled.track[pulled.track.length - 1], ARROW_Y);

  // スポットライト演出の明るさ（0〜1）。
  const glow = Math.min(
    Math.max((time - spaceOpenTime) / (MAX_TIME - spaceOpenTime), 0),
    1
  );
  const spaceCenter = toWorld(openSpace, 0);

  // ボールの現在位置。
  const ball = toWorld(positionAtTime(ballTrack, time), BALL_RADIUS);

  // 現在の時刻(time)に対応する解説文を選ぶ。
  let explanationIndex = 0;
  for (let i = 0; i < TIMES.length; i++) {
    if (time >= TIMES[i]) explanationIndex = i;
  }
  const explanation = explanations[explanationIndex];

  // 実況タイムライン：攻撃側（ホーム）チーム自身の実況データを使う。現在の time に一致するイベントをハイライト。
  const timelineEvents = homeTeam.timeline;
  const activeEventIndex = timelineEvents.findIndex((ev) => ev.time === time);

  // ホームのドロップダウン表示値（念のため TEAMS に無いキーは japan にフォールバック）。
  const homeSelectValue = TEAMS.some((t) => t.key === homeKey)
    ? homeKey
    : "japan";

  return (
    <div>
      {/* チーム選択ドロップダウン（ホーム=攻撃 / アウェイ=守備） */}
      <div className="control">
        <label className="control__label">
          ホーム（攻撃）
          <select
            className="control__select"
            value={homeSelectValue}
            onChange={(e) => {
              setHomeKey(e.target.value);
              setTime(MIN_TIME); // 切り替え時は先頭に戻す
            }}
          >
            {TEAMS.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="control__label">
          アウェイ（守備）
          <select
            className="control__select"
            value={awayKey}
            onChange={(e) => {
              setAwayKey(e.target.value);
              setTime(MIN_TIME); // 切り替え時は先頭に戻す
            }}
          >
            {TEAMS.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        {/* スカウティングレポートの開閉ボタン */}
        <button
          className="report-toggle"
          onClick={() => setShowReport((v) => !v)}
        >
          {showReport ? "レポートを隠す" : "📋 スカウティングレポート"}
        </button>
      </div>

      {/* 監督・フォーメーション・戦術の情報パネル（攻撃側チーム） */}
      <div className="teaminfo">
        <div className="teaminfo__name">{homeTeam.name}</div>
        <div className="teaminfo__meta">
          <span className="teaminfo__tag">監督</span>
          <span>{homeTeam.manager}</span>
          <span className="teaminfo__tag">フォーメーション</span>
          <span>{homeTeam.formation}</span>
        </div>
        <div className="teaminfo__tactics">{homeTeam.tactics}</div>
      </div>

      <div className="scene">
        <Canvas camera={{ position: [0, 45, 45], fov: 50 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[20, 40, 20]} intensity={1} />

          {/* 芝生（刈り込みストライプ）：濃淡2色の緑を横方向に交互配置して臨場感を出す */}
          {Array.from({ length: 10 }).map((_, i) => {
            const stripeW = PITCH_WIDTH / 10; // 帯1本の幅
            const x = -PITCH_WIDTH / 2 + stripeW * (i + 0.5); // 帯の中心X
            return (
              <mesh
                key={i}
                position={[x, 0, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <planeGeometry args={[stripeW, PITCH_DEPTH]} />
                <meshStandardMaterial
                  color={i % 2 === 0 ? "#33523c" : "#2c4836"}
                />
              </mesh>
            );
          })}

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

          {/* 選手（球）＋ 頭上の背番号。ホバーで選手情報ツールチップを表示。 */}
          {players.map((player) => {
            const teamData = player.team === "home" ? homeTeam : awayTeam;
            const seIndex =
              player.team === "home" ? player.id - 1 : player.id - 12;
            const se = teamData.startingEleven[seIndex];
            const shirt = se ? se.number : player.number; // 実際の背番号
            const pos = positionAtTime(player.track, time);
            const [wx, , wz] = toWorld(pos, 0);
            return (
              <group key={player.id}>
                <mesh
                  position={[wx, PLAYER_RADIUS, wz]}
                  onPointerOver={(e) => {
                    e.stopPropagation();
                    setHoveredId(player.id);
                  }}
                  onPointerOut={() => setHoveredId(null)}
                >
                  <sphereGeometry args={[PLAYER_RADIUS, 32, 32]} />
                  <meshStandardMaterial
                    color={player.team === "home" ? "#6b93b8" : "#bd7a70"}
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
                    {shirt}
                  </Text>
                </Billboard>
                {/* ホバー時の選手ツールチップ（背番号・名前・ポジション） */}
                {hoveredId === player.id && se && (
                  <Html
                    position={[wx, PLAYER_RADIUS * 2 + 3.5, wz]}
                    center
                    zIndexRange={[100, 0]}
                  >
                    <div className="tooltip3d">
                      <span className="tooltip3d__num">#{se.number}</span>
                      <span className="tooltip3d__name">{se.name}</span>
                      <span className="tooltip3d__pos">{se.position}</span>
                    </div>
                  </Html>
                )}
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

        {/* フォーメーション情報（ホーム vs アウェイ。プルダウンの選択と動的連動） */}
        <div className="formation">
          <span className="formation__team formation__team--a">
            {homeTeam.name} {homeTeam.formation}
          </span>
          <span className="formation__vs">VS</span>
          <span className="formation__team formation__team--b">
            {awayTeam.name} {awayTeam.formation}
          </span>
        </div>

        {/* タイムライン連動の解説テロップ（3Dの上に重ねる半透明オーバーレイ） */}
        <div className="telop">{explanation}</div>
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

      {/* 実況タイムライン：選択中の攻撃側（ホーム）チームの実況データを表示。クリックでその時刻へジャンプ。 */}
      <div className="timeline">
        <div className="timeline__title">
          実況タイムライン｜{homeTeam.name} vs {awayTeam.name}
        </div>
        <div className="timeline__list">
          {timelineEvents.map((ev, i) => (
            <button
              key={i}
              className={
                "timeline__item" +
                (i === activeEventIndex ? " timeline__item--active" : "")
              }
              onClick={() => setTime(ev.time)}
            >
              <span className="timeline__min">{ev.minute}</span>
              <span className="timeline__text">{ev.text}</span>
            </button>
          ))}
        </div>
      </div>

      {/* スカウティングレポート（画面右側のサイドパネル。ホーム・アウェイ両方を表示） */}
      {showReport && (
        <aside className="report">
          <div className="report__head">
            <div className="report__tabs">
              <button
                className={
                  "report__tab" +
                  (reportTab === "scout" ? " report__tab--active" : "")
                }
                onClick={() => setReportTab("scout")}
              >
                レポート
              </button>
              <button
                className={
                  "report__tab" +
                  (reportTab === "lineup" ? " report__tab--active" : "")
                }
                onClick={() => setReportTab("lineup")}
              >
                スタメン表
              </button>
            </div>
            <button
              className="report__close"
              onClick={() => setShowReport(false)}
              aria-label="閉じる"
            >
              ×
            </button>
          </div>

          {reportTab === "scout"
            ? [
                { team: homeTeam, role: "ホーム（攻撃）" },
                { team: awayTeam, role: "アウェイ（守備）" },
              ].map(({ team, role }) => (
                <div className="report__block" key={role}>
                  <div className="report__role">{role}</div>
                  <div className="report__team">{team.name}</div>

                  <section className="report__section">
                    <h3 className="report__heading">注目選手 / キーマン</h3>
                    {team.keyPlayers.map((kp, i) => (
                      <div className="report__player" key={i}>
                        <div className="report__pbody">
                          <div className="report__pname">
                            {kp.name}
                            <span className="report__club">{kp.club}</span>
                          </div>
                          <div className="report__pstyle">{kp.style}</div>
                        </div>
                      </div>
                    ))}
                  </section>

                  <section className="report__section">
                    <h3 className="report__heading">過去の決定機分析</h3>
                    <ul className="report__chances">
                      {team.pastChances.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </section>
                </div>
              ))
            : [
                { team: homeTeam, role: "ホーム（攻撃）" },
                { team: awayTeam, role: "アウェイ（守備）" },
              ].map(({ team, role }) => (
                <div className="report__block" key={role}>
                  <div className="report__role">{role}</div>
                  <div className="report__team">
                    {team.name}　{team.formation}
                  </div>
                  <ul className="lineup__list">
                    {team.startingEleven.map((p, i) => (
                      <li className="lineup__row" key={i}>
                        <span className="lineup__num">{p.number}</span>
                        <span className="lineup__pos">{p.position}</span>
                        <span className="lineup__name">{p.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
        </aside>
      )}
    </div>
  );
}

export default Stadium;
