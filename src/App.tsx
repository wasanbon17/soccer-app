// 先ほど作った Stadium コンポーネントを読み込みます。
import Stadium from "./components/Stadium";

// アプリの一番外側。今回はタイトルと Stadium を表示するだけのシンプルな構成です。
function App() {
  return (
    <div>
      <h1 style={{ textAlign: "center", fontFamily: "sans-serif" }}>
        サッカースタジアム 2D
      </h1>
      <Stadium />
    </div>
  );
}

export default App;
