# WAITING GAMES / Codex 引き継ぎ書

更新日: 2026-09-11

## 1. プロジェクト概要

「WAITING GAMES」は、**1台のiPhoneを2人で共有して、待ち時間に短時間で遊べるミニゲーム集**を目指すプロジェクトです。

基本方針:
- iPhone縦画面を主対象
- 1台の端末を共有
- 5〜20分程度で遊べる
- オフライン動作を重視
- 外部JSや外部APIへの依存は原則避ける
- 個人情報・APIキー・認証情報をHTMLへ埋め込まない
- 商用化の可能性は将来的に検討するが、現在の最優先は「他人に遊んでもらって面白いかを検証する」こと
- 将来的に GitHub / GitHub Pages / PWA を使い、URL一本で友人に配布できる形を想定
- 各ゲームは独立HTMLだが、最終的には `WAITING GAMES` ランチャーに集約する

推奨ディレクトリ案:

```text
waiting-games/
├─ index.html
├─ games/
│  ├─ shapes.html
│  ├─ dice.html
│  └─ cards.html
├─ assets/
└─ README.md
```

公開時はバージョン付きファイル名ではなく `shapes.html / dice.html / cards.html` の固定名運用が望ましいです。

---

## 2. 開発上の重要ルール

### UI / iPhone
- `100dvh`
- `clamp()`
- `min()`
- `env(safe-area-inset-*)`
- dHPプレビューとホーム画面/URL実行でviewport差があるため、画面高さに依存しすぎない
- タッチターゲットは小さくしすぎない
- iPhone WebView互換性を優先し、新しすぎるJS記法は避ける
- `?.`, `??`, `??=`, `flatMap()` 等は過去に互換性対策で除去した経緯あり

### セキュリティ
- 外部JavaScriptは原則なし
- APIキー / トークン / 個人情報をコードへ含めない
- 商用素材・公式画像・ロゴ・マニュアル・保護された商用アセットを流用しない
- 公開時はHTTPS
- GitHub利用時は2FA推奨
- WAITING GAMES専用repoには本プロジェクト以外のファイルを混在させない

---

# 3. WAITING SHAPES

状態: **完成扱い**
最終版:
`waiting_shapes_v0_7.html`

ユーザーが完成を明言済み。原則、明示依頼がない限り触らない。

## ルール
- 4x4
- 2人
- 各プレイヤー:
  - ○
  - □
  - △
  - ◇
  を各2枚
- 配置ルール:
  - ALL: 同じ行 / 列 / 2x2に同形状が存在すると置けない
  - OPPONENT ONLY: 相手の同形状だけを禁止対象にする
- 勝利条件:
  - STANDARD: 行 / 列 / 2x2に4種揃う
  - OWN 2+: 4種揃い + 最終手プレイヤーの駒が2個以上
- 合法手なし = 即敗北
- タイマー:
  - 5 / 10 / 15 / 20 / 25 / 30秒
- 先手:
  - FIRST / SECOND / RANDOM
- 駒選択:
  - SELF
  - CHOICE
    - 相手が次プレイヤーの使用形状を選ぶ
    - 合法手0の形状は `×0`
- CPU NORMAL 実装済み

## UI
- cream/off-white
- charcoal grid
- P1 dark teal
- P2 muted red/brown
- P2 trayは2P時180°回転
- 左にTURN rail
- bottom: undo / rules / reset
- GAME READY badge

---

# 4. WAITING DICE

状態: **完成扱い**
最終版:
`waiting_dice_v0_3_2.html`

ユーザーが完成を明言済み。原則、明示依頼がない限り触らない。

## 基本
- 2人
- 1台iPhone
- 先に3点で勝利
- 各ラウンドの先手は交互
- 各プレイヤー最大3個までダイスを振る
- 実ダイス合計は非公開
- 宣言値は自由、嘘可
- 宣言履歴に整合性は不要

## 行動
- CALL
- DOUBT
- CHALLENGE

### DOUBT
相手の最新宣言と、相手の実合計を比較

### CHALLENGE
実合計を公開して勝負
同点はCHALLENGEした側が敗北

## プライバシーフロー
PRIVATE → HANDOFF → PUBLIC DECISION → PRIVATE

## 演出
- ダイスアニメ
- DOUBT / CHALLENGE: 3→2→1
- 勝敗時演出
- v0.3.2でiPhone安全寄りのfullscreen confettiを採用

---

# 5. WAITING CARDS

状態: **開発中**
最新HTML:
`waiting_cards_v0_5_4.html`

仕様Excel:
`モンスターバトルV1,2_仕様更新.xlsx`

V1.2 Excelには以下を反映済み:
- モンスター
- マジック
- ルール効果
- 更新履歴 v0.4.0〜v0.5.4

---

## 5-1. 基本ルール

- 2人
- shared deck
- 各4 life
- 初期手札4枚
- 手札上限5
  - 一時的な超過可
  - END TURN時に5枚になるまでデッキ底へ戻す
- フィールド各プレイヤー:
  - Monster LEFT / RIGHT
  - Magic/Trap LEFT / RIGHT
- 対面レーン同士が干渉
- 相手手札は非公開
- 相手伏せ罠は非公開

### AP
通常:
- 先攻1ターン目は設定可能
  - AP1 or AP2
  - ドローあり or なし
- 通常ターン AP2
- 追加AP上限4
- 追加APは次ターンへ持ち越さない

### ATTACK
- 1モンスターにつき基本1ターン1回
- 攻撃宣言後は、そのターン中に同一モンスターで再攻撃不可
- 召喚酔いあり
- 突撃/例外のみ召喚ターン攻撃可

### 戦闘
- ATK比較
- 高い方生存
- 低い方墓地
- 同値は原則双方墓地
- 対面モンスター不在ならダイレクト1ダメージ
  - カード固有効果で変更あり

---

## 5-2. タイミング / 誘発

- 効果を最後まで解決してから誘発確認
- タイミングは逃さない
- 先に発生した誘発を先に処理
- 完全同時:
  - ターンプレイヤー優先
  - 同一プレイヤー内は本人が処理順選択
- 相手ターン中に自分の効果で選択が必要な場合:
  - **効果を発動したプレイヤーに一時的に選択権を移す**
  - 選択完了後、元のターンプレイヤーへ戻す
- CPUが選択権を得た場合はCPU自動処理

この処理は `反魔の儀` で特に重要。

---

## 5-3. TIME MAGIC

各プレイヤー **1ゲーム1回のみ**

発動時:
- 自分のlifeを半分
- 3→1
- 1→1
- life1でも使用可

3択:

1. 場のカード1枚をデッキ底へ
   - AP0

2. 3枚ドロー → 1枚デッキ底へ
   - AP1

3. 自分のターンをスキップし、
   自分の前ターン終了時のフィールドへ巻き戻す
   - AP2

### 巻き戻すもの
- フィールド配置
- カード自身の状態
  - ATK増減
  - 貫通
  - 脱力
  - 戦闘回数
  - 召喚酔い
  - コントロール
  - その他カードローカル状態

### 巻き戻さないもの
- 手札
- 墓地
- life
- デッキ全体
- 通常ドロー履歴
- 乱数結果

実装上、snapshot上フィールドに存在するカードが現在別zoneにある場合は、**同一UIDのカードを現在zoneからフィールドへ再配置し、重複させない**こと。

---

# 6. WAITING CARDS カード仕様

## Monsters

### 激おこドラゴン
ATK10
- 攻撃時プレイヤーダメージ4
- 通常召喚不可

### 錆びたゴーレム
ATK11
- ATK変更不可
- valid battleを2回行うと墓地
- 攻撃無効はbattle countに含めない
- 同値戦闘1回目では通常の相打ち破壊をしない
- 2回目のvalid battle後に墓地
- `battleCount` 必須

### こどもドラゴン
ATK1
- 対面モンスターがいてもプレイヤーへ直接攻撃可能
- 高ATK相手との戦闘でも「戦闘無効」ではなく、
  **戦闘は成立するが戦闘では破壊されない**
- 目的: 貫通を適用可能にする

### ドリルドリ
ATK7
- 貫通1
- 相手を戦闘で倒すと貫通+1
- 攻撃側/防御側どちらでも勝てば上昇
- 強化の書による貫通付与は既存貫通値に加算しない

### ごごご幽霊
ATK3
- 脱力3
- 墓地にいる時、originalSummonerが罠発動成功すると空きモンスター枠へ召喚可能
- originalSummonerのみ恩恵
- 空きがなければ不発
- 召喚酔いあり

### デッドアイズ
ATK4
- 墓地へ送られたとき相手手札1枚を墓地へ
- 召喚時、相手伏せ罠1枚を確認
- 伏せ罠選択は場から直接選択する方針

### 反魔の死人
ATK6
- 罠 / 書の影響を受けない
- 場にいる間、墓地発動効果を無効化

### 失笑ライダー
ATK8
旧「突撃」から変更済み

現在:
- **相手の伏せ罠がある列に召喚したとき AP+1**
- **そのターン攻撃可能**

目的:
召喚APを戻し、そのままATTACKを選べるようにする

### 死霊師
ATK2
- UI用語は「チョイス」
- 2択:
  1. 墓地の書/魔法を1枚手札へ
  2. 墓地のごごご幽霊 or 反魔の死人を空きmonster slotへ召喚

※発動タイミングの最終仕様はExcel/実装確認推奨

### デスマスク
ATK5
- 場→墓地で、場のカード1枚を墓地へ
- 自分/相手フィールド両方対象
- 場対象はフィールドから直接選択

### 入れかえ壺
ATK9
- 場のカード1枚と墓地の同種カードを入れ替える
- 種類 = Monster / Trap
- 即時魔法/書は対象外
- 場側対象はフィールドから直接選択

---

## Magic / Trap

### 復活の魔法
Trap / Instant
- 同列で相手が攻撃
- 墓地monster1体を同列へ召喚
- 相手ターン発動なら相手AP+1
- AP上限4

### 反攻の儀
Trap
- 同列攻撃
- 攻撃無効
- 相手life -1

### 召喚の魔法
Trap / Instant
- 同列で相手が攻撃
- 手札monsterを同列へ召喚
- 相手ターン発動なら相手AP+1
- AP上限4

### 反魔の儀
Trap
- 相手が「書」を発動時
- そのカードの発動権利を奪う
- ターゲット選択は反魔の儀側が最初から行う
- 相手ターンでも一時的に発動者へ選択権移譲

### 加速の書
Trap
- 自分ターン開始時 or 除去時
- draw2
- 一度発動したら墓地

### 脱出の儀
Trap
- 相手が同列にmonsterを置いた時
- そのmonsterを手札へ戻す
- 両者draw1

### 変身の書
Instant
- 場の激おこドラゴン / こどもドラゴンを選択
- 対応する逆カードを field / hand / deck / grave から探し位置交換
- 場側対象はフィールドから直接選択

### 平凡の書
Instant
- 1つ選択:
  - 相手life -1
  - 場のmonster1体へ脱力2
- ＋ 自分life +1 は必ず発動

### 強化の書
Instant
- field monster1体
- ATK +3
- 貫通付与
- 既に貫通持ちなら貫通値は増やさない
- 反魔の死人には効かない
- 場対象は直接選択

### 魔導の書
Instant
CHOICE:
1. 相手手札ランダム1枚を奪う
2. ATK5以下の相手monsterのcontrolを得る

- 自分monster slot空きなしなら対象monsterは墓地
- control取得monsterは召喚酔い
- 場対象は直接選択

### 破壊の魔法
**Trap**
旧:
- 罠・即時
- 列が全埋まり

現在:
- セット時、列の枚数条件なし
- **セットした次のEND PHASEに発動**
- その列のカードを枚数に関係なく全て墓地へ
- 自分/相手両方対象

v0.5.4:
- 複数墓地送り時に `owner` が undefined になるケースを修正
- owner/controllerが欠けてもP1/P2へ補正
- 誘発キューにもguard追加

### 天魔の書
Instant
CHOICE:
1. 墓地monster1枚を手札
2. field monsterとgrave monsterを交換

場側対象は直接選択

---

# 7. Keyword

## 貫通X
battleが成立した時、相手playerにXダメージ
- 相打ちでも発動
- 勝敗とは無関係
- こどもドラゴンの高ATK耐性でもbattleが成立するため適用される

## 脱力X
battle時、相手ATKをX下げる
- 永続
- battle前に適用
- 永続ATK減少として扱う

## 突撃
召喚ターン攻撃可
ATTACK AP1は必要

## チョイス
複数候補から1つ選択
UI文言は「チョイス」を優先

---

# 8. WAITING CARDS UI / UX

## 色
- cream/off-white
- charcoal
- P1 dark teal/green
- P2 muted red/brown

## 基本
- portrait
- rounded card UI
- top score
- large touch buttons
- RULES / GRAVE / RESET

## 墓地
- ゲーム中いつでもGRAVEから確認可能
- 墓地対象選択時:
  - card name
  - ATK
  - 効果
  を表示

## フィールド対象選択
ポップアップ選択ではなく、**原則フィールド上から直接タップ**する。

対象:
- ATTACK
- TIME MAGIC
- 強化
- 脱力
- control
- 変身の書
- デスマスク
- 入れかえ壺
- デッドアイズ trap peek
- その他「場を対象に取る」効果

## ATTACK
ATTACKボタン押下
→ attackable monster slot highlight
→ フィールド上monsterを直接タップ

## 2 PLAYER
- 自分ターン中:
  - card effect簡易エフェクト
- 相手へターンを渡す:
  - previous turn内容をTURN DIGEST banner rowとして表示
- 旧中央popup型digestは廃止
- HANDOFF時は手札を完全非表示
- READY後、すぐ操作可能

## VS CPU
- P1 / CPUどちらも簡易effectのみ
- TURN DIGESTなし
- CPU行動は少し間を置いて可視化

---

# 9. CPU NORMAL

v0.4.0から実装

目的:
「強AI」ではなく、1人でも対人戦に近いデバッグができること

方針:
- 完全randomではなくaction scoring
- 例:
  - direct attack 高評価
  - 勝てる戦闘 高評価
  - 負ける戦闘 低評価
  - strong summon 高評価
  - trap placement
  - spell usage
  - TIME MAGIC
- プレイヤーの非公開手札や伏せ罠の正体を判断材料にしない
- CPUターンは0.5〜1秒程度の間を入れて見せる

タイトル:
- 2 PLAYER
- VS CPU

---

# 10. 対戦統計

v0.5.0から

localStorage保存

記録:
- total matches
- P1 wins
- P2 wins
- draws
- first-player wins
- second-player wins
- CPU matches
- CPU wins

タイトル画面からreset可能

---

# 11. WAITING GAMES Launcher

現在:
`waiting_games_launcher_demo_v0_1.html`

ユーザー評価:
- 「シンプルでわかりやすい」
- 基本方針として採用方向

## コンセプト
「開く → 選ぶ → すぐ遊ぶ」

## 現在デモの要素
- WAITING GAMES logo
- 「2人の待ち時間を、ちょっと面白く。」
- 今何分ある?
  - 3〜5分
  - 10分
  - 20分
- SHAPES / DICE / CARDS card
- 各card:
  - 人数
  - 時間
  - genre
  - difficulty
  - PLAY
- RANDOM
- ABOUT
- UPDATE

## 推奨
最初は豪華にしすぎない
- brand
- game cards
- play
- rules/about
- updates
- version

ゲーム数が増えるまでは検索/複雑なカテゴリタブ不要

---

# 12. 次フェーズ

ユーザーはここから **Codexへ作業移行予定**

推奨順:

1. GitHub repo作成
2. launcher + 3games を1repoへ集約
3. 各gameファイル名を固定化
   - `games/shapes.html`
   - `games/dice.html`
   - `games/cards.html`
4. launcherのPLAYを実gameへ接続
5. 各gameへ
   - `← WAITING GAMES`
   を追加
6. GitHub Pages有効化
7. iPhone SafariでURL動作確認
8. 必要ならPWA化
9. 友人テスト
10. feedback収集

---

# 13. Codex作業時の注意

### 変更前
- 既存ゲームのルール変更を勝手にしない
- 特にSHAPES/DICEは完成扱い
- CARDSはExcel仕様を優先

### 更新時
- HTML全体の起動確認
- JS syntax check
- Safari/iPhone互換性
- CPU / 2P両方確認
- HANDOFF privacy確認
- effect selection ownership確認

### CARDSで重点テスト
- 破壊の魔法 + 複数誘発
- 反魔の儀 + 相手ターン中のselection owner
- TIME MAGIC snapshot復元
- field direct-selection
- grave selection
- summoning sickness
- ATTACK once-per-monster-per-turn
- AP max4
- CPU no-cheating(public information only)

---

# 14. 重要ファイル

現時点で参照すべきもの:

- `waiting_shapes_v0_7.html`
- `waiting_dice_v0_3_2.html`
- `waiting_cards_v0_5_4.html`
- `waiting_games_launcher_demo_v0_1.html`
- `モンスターバトルV1,2_仕様更新.xlsx`

---

# 15. 最終方針

WAITING GAMESの最優先は、
**「他人に受け入れられるゲームか確認すること」**

収益化はその後。

まずは:
- 友人がURLを開く
- 説明なしでもゲームを選べる
- 1回遊べる
- 「もう一回」が自然に出る

この状態を目標にする。

商用化は、
「欲しいならお金を払ってもいい」
という段階に入ってから検討する。
