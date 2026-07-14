# 高架裏 (gakaura)

重力反転で首都高の裏面を走るエンドレスランナー。桁裏の緑パネルが路面、頭上には夜の街が逆さまにぶら下がる。

## 遊び方

| 操作 | キー |
|---|---|
| ハンドル | ← → (A / D) |
| ジャンプ | スペース (長押しでふわっと滞空) |
| 加速 / ブレーキ | ↑ / ↓ (W / S) |
| 再走 | R |

スマホ: 画面下半分の左右タッチでハンドル、上半分タップでジャンプ。

- 橋脚のハンマーヘッドは左右に避ける (中央の柱はジャンプでも越えられない)
- 継ぎ目の段差はジャンプで越える (オレンジの光が目印)
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

- `src/main.js` — ゲーム状態・物理・メインループ
- `src/world.js` — セグメント生成・リサイクル・衝突判定
- `src/scene.js` — レンダラ・カメラ・ライト
- `src/textures.js` — Canvas 描画 → DataTexture 化 (canvas パージ対策) と材質
- `src/car.js` — 車のメッシュ
- `src/input.js` — キーボード / タッチ入力
- `src/audio.js` — WebAudio (エンジン音・効果音)
- `src/hud.js` — HUD とオーバーレイ

注意: `useLegacyLights` 前提で照明を調整している。three を r165 以降へ上げる場合は光量の再調整が必要。
