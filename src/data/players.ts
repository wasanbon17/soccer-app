// コート上の1点（座標）を表す型。x=横位置, y=縦位置（どちらも0〜100の割合）。
export type Position = { x: number; y: number };

// 選手1人ぶんのデータの「型」。
export type Player = {
  id: number; // 選手をユニークに識別する番号（22人で重複しない）
  team: "home" | "away"; // home=攻撃側(Team A) / away=守備側(Team B)
  number: number; // 背番号（各チーム内で 1〜11、GK=1）
  name: string; // 内部用ラベル（表示はしない）
  track: Position[]; // 時刻ごとの座標。TIMES と同じ並び順・個数。
};

// 時間軸の目盛り。0〜100 を 5 点で区切った想定。
export const TIMES = [0, 25, 50, 75, 100];

// ============================================================
// 座標生成ヘルパー
//  ・track(from, to) … from→to を TIMES の個数(5点)に等間隔補間。
//    to を省略すると静止（基本ポジション維持）。
// ============================================================
function lerp(a: number, b: number, ratio: number): number {
  return a + (b - a) * ratio;
}
function track(from: Position, to: Position = from): Position[] {
  return TIMES.map((_, i) => {
    const r = i / (TIMES.length - 1); // 0, 0.25, 0.5, 0.75, 1
    return { x: lerp(from.x, to.x, r), y: lerp(from.y, to.y, r) };
  });
}
function distance(a: Position, b: Position): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ============================================================
// フォーメーション定義
//  ・各ラインの x（攻撃方向の深さ）と、そのラインに並ぶ選手の y 配列。
//  ・home は左→右（x↑）へ攻撃。away はこれを左右反転（x→100-x）して配置。
//  ・GK から順に並べ、id は home=1〜11 / away=12〜22 を自動採番。
// ============================================================
type Lane = { x: number; ys: number[] };
const FORMATIONS: Record<string, Lane[]> = {
  "4-2-3-1": [
    { x: 8, ys: [50] },
    { x: 24, ys: [16, 40, 60, 84] },
    { x: 40, ys: [38, 62] },
    { x: 55, ys: [22, 50, 78] },
    { x: 66, ys: [50] },
  ],
  "3-4-2-1": [
    { x: 8, ys: [50] },
    { x: 24, ys: [28, 50, 72] },
    { x: 42, ys: [12, 40, 60, 88] },
    { x: 56, ys: [36, 64] },
    { x: 66, ys: [50] },
  ],
  "4-3-3": [
    { x: 8, ys: [50] },
    { x: 24, ys: [16, 40, 60, 84] },
    { x: 44, ys: [30, 50, 70] },
    { x: 62, ys: [22, 50, 78] },
  ],
  "3-5-2": [
    { x: 8, ys: [50] },
    { x: 24, ys: [28, 50, 72] },
    { x: 44, ys: [12, 32, 50, 68, 88] },
    { x: 62, ys: [40, 60] },
  ],
};

// フォーメーション文字列 → 11人ぶんの基本ポジション（GKから順）。
function basePositions(formation: string, side: "home" | "away"): Position[] {
  const lanes = FORMATIONS[formation];
  const pts: Position[] = [];
  for (const lane of lanes) {
    for (const y of lane.ys) {
      pts.push({ x: side === "home" ? lane.x : 100 - lane.x, y });
    }
  }
  return pts;
}

// home(攻撃) と away(守備) の陣形から、22人ぶんの静止プレイヤーを生成。
function buildPlayers(formationA: string, formationB: string): Player[] {
  const home = basePositions(formationA, "home").map((p, i) => ({
    id: i + 1,
    team: "home" as const,
    number: i + 1,
    name: `home-${i + 1}`,
    track: track(p),
  }));
  const away = basePositions(formationB, "away").map((p, i) => ({
    id: i + 12,
    team: "away" as const,
    number: i + 1,
    name: `away-${i + 1}`,
    track: track(p),
  }));
  return [...home, ...away];
}

// 指定した選手だけ「基本位置 → to」へ動かす（戦術アクションの付与）。
type Move = { id: number; to: Position };
function withMoves(players: Player[], moves: Move[]): Player[] {
  return players.map((p) => {
    const m = moves.find((mv) => mv.id === p.id);
    return m ? { ...p, track: track(p.track[0], m.to) } : p;
  });
}

// 空くスペース(target)に最も近いアウェイ選手(GK除く)を「釣られる守備」に選出。
// どのアウェイ陣形でも自然に成立するよう、固定IDではなく距離で動的に決める。
function nearestAwayId(players: Player[], target: Position): number {
  let bestId = -1;
  let bestDist = Infinity;
  for (const p of players) {
    if (p.team !== "away" || p.number === 1) continue; // GKは除外
    const d = distance(p.track[0], target);
    if (d < bestDist) {
      bestDist = d;
      bestId = p.id;
    }
  }
  return bestId;
}

// ============================================================
// チーム単体データ（自国の陣形・監督・戦術＋攻撃時のアクション）
// ============================================================
export type TeamData = {
  key: string;
  name: string;
  manager: string;
  formation: string;
  tactics: string; // 戦術の特徴（一文）
  keyPlayers: { name: string; club: string; style: string }[]; // 注目選手・要注意プレーヤー
  pastChances: string[]; // 過去の決定機・得点パターンの分析
  // 実況タイムライン。time はシークバー位置(0〜100)に対応し、クリックでその局面へジャンプ。
  timeline: { minute: string; text: string; time: number }[];
  decoyId: number; // 囮（実線の矢印）= home の選手ID
  decoyTo: Position; // 囮の到達点
  extraMoves?: Move[]; // オーバーラップ等、矢印を出さない補助の動き
  openSpace: Position; // 空くスペース（スポットライト位置）
  ballStart: Position; // ボールの始点（終点は openSpace）
  explanations: string[]; // 時刻連動の解説テロップ（TIMES と同数=5）
};

const SPACE_OPEN_TIME = 50; // スペースが光り始める時刻（全シナリオ共通）

export const TEAMS: TeamData[] = [
  // ----- 日本代表（森保一 / 4-2-3-1） -----
  // 左の中村敬斗(id10)がハーフスペースへカットイン(囮)→左SB(id5)が大外をオーバーラップ(補助)。
  {
    key: "japan",
    name: "日本代表",
    manager: "森保一",
    formation: "4-2-3-1",
    tactics:
      "可変式4-2-3-1。中村敬斗のカットインと、左SBのオーバーラップで左サイドを崩す。",
    keyPlayers: [
      { name: "中村敬斗", club: "スタッド・ランス", style: "内側へ絞ってのミドルシュートとチャンスメイクを担う左の主軸" },
      { name: "伊東純也", club: "KRCヘンク", style: "右サイドを切り裂く絶対的なスピードスター" },
    ],
    pastChances: [
      "左サイドで中村敬斗がタメを作り、内側へ絞ってからの右足ミドルシュート。",
      "大外を回り込む左サイドバックへのスルーパス → 深い位置からの折り返しでフィニッシュ。",
    ],
    timeline: [
      { minute: "0分", text: "キックオフ。森保ジャパンが4-2-3-1で立ち上がる。", time: 0 },
      { minute: "15分", text: "左サイドで中村敬斗がタメを作り、リズムを掴み始める。", time: 25 },
      { minute: "24分", text: "左サイドの崩し！中村が内側へ絞り、相手SBを引きつける。", time: 50 },
      { minute: "38分", text: "空いた大外を左SBがオーバーラップ、決定的なクロス。", time: 75 },
      { minute: "45分", text: "前半終了間際、左サイド起点に決定機を作り出す。", time: 100 },
    ],
    decoyId: 10, // 左の中村敬斗（AM左）
    decoyTo: { x: 70, y: 58 }, // 内側ハーフスペースへ絞る
    extraMoves: [{ id: 5, to: { x: 66, y: 86 } }], // 左SBの大外オーバーラップ
    openSpace: { x: 70, y: 82 }, // 空いた大外レーン
    ballStart: { x: 50, y: 70 },
    explanations: [
      "森保ジャパン、4-2-3-1で前進を開始。左サイドに中村敬斗が構える。",
      "中村敬斗がボールを受け、内側のハーフスペースへ絞っていく。",
      "中村のカットインに相手のサイドが食いつき、大外のレーンが空く。",
      "空いた大外を左サイドバックが一気にオーバーラップ。",
      "深い位置で折り返し——中央へのクロスから決定機を作る。",
    ],
  },

  // ----- オランダ代表（クーマン / 3-4-2-1） -----
  // 右WB(id5)が高い位置へ押し上げ(囮)→左WB(id8)も高い位置へ(補助)。内側に空いたスペースを使う。
  {
    key: "netherlands",
    name: "オランダ代表",
    manager: "クーマン",
    formation: "3-4-2-1",
    tactics:
      "最後尾からの流麗なビルドアップ。両ウイングバックが高い位置を取り、幅を作って前進する。",
    keyPlayers: [
      { name: "シャビ・シモンズ", club: "トッテナム・ホットスパー", style: "ハーフスペースの支配者" },
      { name: "ジェレミー・フリンポン", club: "リヴァプールFC", style: "超攻撃的右WB" },
      { name: "タイアニ・ラインデルス", club: "マンチェスター・シティ", style: "中盤の運び屋" },
    ],
    pastChances: [
      "シモンズが右ハーフスペースでボールを引き出して相手SBを釣り出し、空いた大外をフリンポンが駆け上がってクロス——『右サイドのオーバーロード』から多くの決定機を創出。",
      "最終ラインからのロングフィードで、一気に背後を突く形も持つ。",
    ],
    timeline: [
      { minute: "0分", text: "キックオフ。オランダが3-4-2-1でボールを握る。", time: 0 },
      { minute: "12分", text: "最後尾から丁寧にビルドアップを開始する。", time: 25 },
      { minute: "27分", text: "右WBフリンポンが高い位置へ——右サイドのオーバーロード。", time: 50 },
      { minute: "40分", text: "シモンズが空いた内側へ流れ込み、前進の起点に。", time: 75 },
      { minute: "45分", text: "流麗なパスワークから中央を割り、決定機を創出。", time: 100 },
    ],
    decoyId: 5, // 右ウイングバック
    decoyTo: { x: 76, y: 10 },
    extraMoves: [{ id: 8, to: { x: 72, y: 90 } }], // 左WBも高い位置へ（両WB高い）
    openSpace: { x: 64, y: 26 },
    ballStart: { x: 20, y: 50 }, // 最後尾から
    explanations: [
      "クーマンのオランダ、3バックで最後尾から丁寧にビルドアップ。",
      "両ウイングバックが高い位置を取り、ピッチに幅を作る。",
      "右WBの押し上げが相手を引き出し、内側のスペースが空く。",
      "シャドーがそのスペースに流れ込み、前進の起点になる。",
      "流麗なパスワークから中央を割り、決定機を創出。",
    ],
  },

  // ----- チュニジア代表（ベンザルティ / 4-3-3） -----
  // 堅守からの速攻。CF(id10)が最終ライン背後へ抜け出す(囮)。
  {
    key: "tunisia",
    name: "チュニジア代表",
    manager: "ベンザルティ",
    formation: "4-3-3",
    tactics:
      "自陣の堅固なブロックから、ボールを奪って一気に前線へ繋ぐ鋭いカウンター。",
    keyPlayers: [
      { name: "エリス・スキリ", club: "アイントラハト・フランクフルト", style: "中盤の底でのボール奪取と展開の要" },
    ],
    pastChances: [
      "自陣深くでスキリを中心とした強固なブロックでボールを奪取し、手数をかけずに前線の両翼へ展開する鋭いショートカウンター。",
    ],
    timeline: [
      { minute: "0分", text: "キックオフ。チュニジアが4-3-3で自陣に構える。", time: 0 },
      { minute: "18分", text: "スキリ中心の堅固なブロックで相手の攻撃を受け止める。", time: 25 },
      { minute: "31分", text: "ボールを奪った！一気に前線へギアチェンジ。", time: 50 },
      { minute: "39分", text: "最前線のFWが相手最終ラインの背後へ抜け出す。", time: 75 },
      { minute: "44分", text: "鋭いカウンターでGKと一対一の決定機へ。", time: 100 },
    ],
    decoyId: 10, // センターフォワード
    decoyTo: { x: 88, y: 44 }, // 最終ライン背後へ
    openSpace: { x: 84, y: 44 },
    ballStart: { x: 30, y: 55 }, // 自陣深くから一気に
    explanations: [
      "チュニジア、自陣に4-3-3の堅固なブロックを敷いて耐える。",
      "中央を圧縮し、相手の攻撃を外へと追い込む。",
      "ボールを奪った瞬間、一気に前線へギアチェンジ。",
      "最前線のFWが相手最終ラインの背後へ抜け出す。",
      "鋭いカウンターが完成、GKと一対一の決定機へ。",
    ],
  },

  // ----- スウェーデン代表（トマソン / 3-5-2） -----
  // 攻撃的ハイプレス。2トップの一角(id10)が背後へ(囮)。
  {
    key: "sweden",
    name: "スウェーデン代表",
    manager: "トマソン",
    formation: "3-5-2",
    tactics:
      "従来の堅守速攻から脱却。流動的なパスワークと攻撃的なハイプレスで主導権を握る。",
    keyPlayers: [
      { name: "ヴィクトル・ギョェケレス", club: "アーセナルFC", style: "理不尽なフィジカルと決定力を持つ怪物ストライカー" },
      { name: "デヤン・クルゼフスキ", club: "トッテナム・ホットスパー", style: "左足のチャンスメーカー" },
    ],
    pastChances: [
      "クルゼフスキが右から内側へ運んで相手ディフェンスの視線を集め、その裏へギョケレスが暴力的なスピードで抜け出して一撃で仕留めるパターンが強力。",
    ],
    timeline: [
      { minute: "0分", text: "キックオフ。スウェーデンが3-5-2で攻撃的に入る。", time: 0 },
      { minute: "14分", text: "前線から連動した激しいハイプレスを仕掛ける。", time: 25 },
      { minute: "25分", text: "高い位置でボールを奪取、流動的に前を向く。", time: 50 },
      { minute: "36分", text: "2トップが最終ラインの背後へ鋭く抜け出す。", time: 75 },
      { minute: "45分", text: "縦に速い攻撃で守備を置き去りにし、ゴールへ迫る。", time: 100 },
    ],
    decoyId: 10, // 2トップの一角
    decoyTo: { x: 84, y: 28 },
    openSpace: { x: 80, y: 30 },
    ballStart: { x: 45, y: 40 },
    explanations: [
      "トマソンのスウェーデン、3-5-2で攻撃的に陣形を整える。",
      "前線から連動して激しくハイプレスを仕掛ける。",
      "高い位置でボールを奪い、流動的なパスワークで前を向く。",
      "2トップが最終ラインの背後へ鋭く抜け出す。",
      "縦に速い攻撃で守備を置き去りにし、ゴールへ迫る。",
    ],
  },
];

// ============================================================
// 試合（ホーム×アウェイ）データ。Stadium が描画に使う最終的な形。
// ============================================================
export type Match = {
  home: TeamData; // 攻撃側
  away: TeamData; // 守備側
  players: Player[]; // 22人
  decoyId: number; // 囮（実線の矢印）
  pulledId: number; // 釣られる守備（点線の矢印、自動選出）
  openSpace: Position;
  spaceOpenTime: number;
  ballTrack: Position[];
  explanations: string[];
};

// ホーム/アウェイのキーから試合データを組み立てる。
export function buildMatch(homeKey: string, awayKey: string): Match {
  const home = TEAMS.find((t) => t.key === homeKey) ?? TEAMS[0];
  const away = TEAMS.find((t) => t.key === awayKey) ?? TEAMS[1];

  // 22人を両陣形で配置 → 釣られる守備を自動選出 → 戦術アクションを付与。
  const base = buildPlayers(home.formation, away.formation);
  const pulledId = nearestAwayId(base, home.openSpace);
  const players = withMoves(base, [
    { id: home.decoyId, to: home.decoyTo }, // 囮の動き
    ...(home.extraMoves ?? []), // 補助の動き
    { id: pulledId, to: home.decoyTo }, // 釣られる守備は囮を追って動く
  ]);

  return {
    home,
    away,
    players,
    decoyId: home.decoyId,
    pulledId,
    openSpace: home.openSpace,
    spaceOpenTime: SPACE_OPEN_TIME,
    ballTrack: track(home.ballStart, home.openSpace),
    explanations: home.explanations,
  };
}
