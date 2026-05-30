const emergencySampleItems = [
  { name: "滅菌ガーゼ", location: "救急カート 上段", stock: 24, minimum: 20, unit: "枚", memo: "5枚入りパック" },
  { name: "非滅菌ガーゼ", location: "処置室 棚A", stock: 40, minimum: 30, unit: "枚", memo: "" },
  { name: "絆創膏 S", location: "救急カート 上段", stock: 50, minimum: 30, unit: "枚", memo: "" },
  { name: "絆創膏 M", location: "救急カート 上段", stock: 35, minimum: 30, unit: "枚", memo: "" },
  { name: "絆創膏 L", location: "救急カート 上段", stock: 18, minimum: 20, unit: "枚", memo: "不足確認" },
  { name: "包帯 伸縮 5cm", location: "処置室 棚A", stock: 12, minimum: 10, unit: "巻", memo: "" },
  { name: "包帯 伸縮 10cm", location: "処置室 棚A", stock: 7, minimum: 10, unit: "巻", memo: "" },
  { name: "サージカルテープ 12mm", location: "救急カート 上段", stock: 14, minimum: 10, unit: "巻", memo: "" },
  { name: "サージカルテープ 25mm", location: "救急カート 上段", stock: 8, minimum: 10, unit: "巻", memo: "" },
  { name: "消毒綿", location: "救急カート 上段", stock: 60, minimum: 50, unit: "包", memo: "" },
  { name: "アルコール綿", location: "処置室 棚B", stock: 42, minimum: 40, unit: "包", memo: "" },
  { name: "生理食塩水 100mL", location: "処置室 棚B", stock: 15, minimum: 10, unit: "本", memo: "" },
  { name: "生理食塩水 500mL", location: "処置室 棚B", stock: 8, minimum: 10, unit: "本", memo: "期限確認対象" },
  { name: "精製水 500mL", location: "処置室 棚B", stock: 10, minimum: 8, unit: "本", memo: "" },
  { name: "ニトリル手袋 S", location: "救急カート 下段", stock: 5, minimum: 4, unit: "箱", memo: "" },
  { name: "ニトリル手袋 M", location: "救急カート 下段", stock: 3, minimum: 4, unit: "箱", memo: "" },
  { name: "ニトリル手袋 L", location: "救急カート 下段", stock: 4, minimum: 4, unit: "箱", memo: "" },
  { name: "サージカルマスク", location: "救急カート 下段", stock: 6, minimum: 5, unit: "箱", memo: "" },
  { name: "フェイスシールド", location: "救急カート 下段", stock: 12, minimum: 10, unit: "枚", memo: "" },
  { name: "使い捨てエプロン", location: "救急カート 下段", stock: 28, minimum: 30, unit: "枚", memo: "" },
  { name: "冷却材", location: "備品庫 棚C", stock: 6, minimum: 5, unit: "個", memo: "冷凍庫保管" },
  { name: "三角巾", location: "備品庫 棚C", stock: 9, minimum: 8, unit: "枚", memo: "" },
  { name: "副木 S", location: "備品庫 棚C", stock: 4, minimum: 3, unit: "本", memo: "" },
  { name: "副木 M", location: "備品庫 棚C", stock: 3, minimum: 3, unit: "本", memo: "" },
  { name: "副木 L", location: "備品庫 棚C", stock: 2, minimum: 3, unit: "本", memo: "" },
  { name: "使い捨てピンセット", location: "処置室 棚A", stock: 16, minimum: 10, unit: "本", memo: "" },
  { name: "使い捨てはさみ", location: "処置室 棚A", stock: 7, minimum: 5, unit: "本", memo: "" },
  { name: "体温計カバー", location: "救急カート 中段", stock: 45, minimum: 30, unit: "個", memo: "" },
  { name: "パルスオキシメータ用電池", location: "救急カート 中段", stock: 6, minimum: 4, unit: "本", memo: "単4電池" },
  { name: "廃棄物用ビニール袋", location: "処置室 棚B", stock: 20, minimum: 20, unit: "枚", memo: "" }
  ,{ name: "アドレナリン", location: "救急カート 中段", stock: 10, minimum: 5, unit: "本", memo: "期限別管理", lots: [{ quantity: 5, expiry: "2027-04" }, { quantity: 5, expiry: "2026-06" }] }
];

if (typeof module !== "undefined") {
  module.exports = emergencySampleItems;
} else {
  globalThis.EMERGENCY_SAMPLE_ITEMS = emergencySampleItems;
}
