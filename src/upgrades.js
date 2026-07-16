/* Level-up upgrade definitions. Levels are 0-based internally;
   desc[i] describes what taking level i+1 gives you. */
export const UPGRADES = [
  {
    id: 'smash',
    name: '衝撃波',
    desc: [
      'スラム着地で衝撃波 12m',
      '衝撃波を 22m に強化',
      '衝撃波 34m — ビルを粉砕して XP に変える',
    ],
    max: 3,
  },
  {
    id: 'magnet',
    name: '磁力',
    desc: ['オーブ吸引範囲 +150%', '吸引範囲さらに拡大', '吸引範囲 最大'],
    max: 3,
  },
  {
    id: 'float',
    name: '滞空',
    desc: ['跳躍が高く、滞空が長くなる', '滞空強化', 'ほぼ浮遊'],
    max: 3,
  },
  {
    id: 'speed',
    name: '韋駄天',
    desc: ['最高速度 +18 km/h', '最高速度 +18 km/h', '最高速度 +18 km/h'],
    max: 3,
  },
];

/* Pick up to three distinct upgrades that still have levels left. */
export function pickThree(levels) {
  const avail = UPGRADES.filter((u) => (levels[u.id] || 0) < u.max);
  for (let i = avail.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [avail[i], avail[j]] = [avail[j], avail[i]];
  }
  return avail.slice(0, 3);
}
