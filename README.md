# 高架裏 (gakaura)

重力反転で首都高の裏面を爆走するエンドレスランナー。コースは**首都高 C1 都心環状線の実線形 12.5km ループ** (OpenStreetMap 由来、江戸橋の最小半径 51m カーブ含む)。視点は普通のまま——逆さまの巨人が天井 (桁裏の緑パネル) を蹴って全力疾走し、眼下には夜の街と普通の交通が流れる。跳躍すると桁を離れて下へふわっと落ち、また吸い付く。

## 遊び方

| 操作 | キー |
|---|---|
| ハンドル | ← → (A / D) |
| ジャンプ | スペース (長押しでふわっと滞空) |
| 加速 / ブレーキ | ↑ / ↓ (W / S) |
| 再走 | R |

スマホ: 画面下半分の左右タッチでハンドル、上半分タップでジャンプ。

- 橋脚のハンマーヘッドは左右に避ける (中央の柱はジャンプでもかわせない)
- 継ぎ目の梁はジャンプでくぐる (オレンジの光が目印)
- 光の玉を拾うと距離 +25m
- ベスト記録は localStorage に保存

## 開発

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ に出力
npm run preview  # ビルド結果の確認
```

## 構成

- `src/main.js` — ゲーム状態・物理・メインループ (弧長ベースでコース追従)
- `src/path.js` — C1 実線形 (`c1path.json`、5m 間隔 2,491 点) の frame/曲率計算
- `src/world.js` — セグメント生成・リサイクル・衝突判定
- `src/scene.js` — レンダラ・カメラ・ライト
- `src/textures.js` — Canvas 描画 → DataTexture 化 (canvas パージ対策) と材質
- `src/giant.js` — 巨人のメッシュと手続き走行アニメ (関節ピボット + 走り / 跳躍ポーズ)
- `src/car.js` — 車のメッシュ (下の道路の通行車用)
- `src/input.js` — キーボード / タッチ入力
- `src/audio.js` — WebAudio (エンジン音・効果音)
- `src/hud.js` — HUD とオーバーレイ

注意: `useLegacyLights` 前提で照明を調整している。three を r165 以降へ上げる場合は光量の再調整が必要。

## 出典

- コース線形: © OpenStreetMap contributors (ODbL)
