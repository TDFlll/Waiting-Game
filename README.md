# WAITING GAMES

1台のiPhoneを共有して、待ち時間に短時間で遊べるミニゲーム集です。

## Files

```text
waiting-games/
├─ index.html
├─ manifest.webmanifest
├─ service-worker.js
├─ offline-manifest.json
├─ offline-manager.js
├─ offline.html
├─ icons/
│  ├─ icon.svg
│  └─ maskable.svg
├─ games/
│  ├─ shapes.html
│  ├─ dice.html
│  ├─ cards.html
│  ├─ auction.html
│  ├─ robots.html
│  ├─ escape.html
│  ├─ line.html
│  ├─ helper.html
│  ├─ draw.html
│  ├─ derby.html
│  ├─ memory-line.html
│  └─ shift.html
└─ README.md
```

## Included Versions

- `games/shapes.html` from `waiting_shapes_v0_8_1_c1.html`
- `games/dice.html` from `waiting_dice_v0_3_2.html`
- `games/cards.html` v0.6.6 / V1.3 (edited card effects, two-use MAGIC, persistent turn handoff summary, individual decks and graves, card catalog)
- `games/auction.html` from `waiting_auction_v0.1_UI16.html`
- `games/robots.html` from `waiting_robots_v4.7.html`
- `games/escape.html` from `waiting_escape_prototype_v0_20.html`
- `games/line.html` v2.3.1 from `Waiting_Line_DEMO_v2.2.html` (launcher and CPU integration)
- `games/helper.html` from `Board_Game_Helper_v1.03.html`
- `games/draw.html` from `Waiting_Draw_v0.2.5_import_export.html`
- `games/derby.html` v0.10 (WAITING DERBY; shared player names, Free Open / Randm Open)
- `games/memory-line.html` from `Waiting_Memory_Line_v0.5.html` (shared player names and launcher return links)
- `games/shift.html` from `Waiting_Shift_v0.9.1.html` (shared player names and confirmed launcher return)
- `index.html` from `waiting_games_launcher_demo_v0_1.html`

## Offline Use

The launcher includes a PWA/offline manager for GitHub Pages.

1. Open the published site while online.
2. Open `オフラインDL` below the game list, then tap `全ゲームを一括ダウンロード`.
3. Wait until the status says the download is complete.
4. Use `状態更新` to confirm each game shows `保存済み`.
5. On iPhone, add the site to the Home Screen after saving if you want app-like startup.

`更新確認` reloads `offline-manifest.json` from the network and compares saved versions.
`一括更新` downloads the current offline bundle again.

## Notes

- The launcher `PLAY` buttons open the fixed game paths above.
- Each game has a `← GAMES` link back to `../index.html`. Waiting Draw keeps this link in its left main menu so it does not cover the canvas, and waits for pending saves before returning.
- Games include launcher return links and shared player-name integration.
- All launcher return links require a YES/NO confirmation, including on game title screens. NO or Escape keeps the current screen; DRAW still saves pending edits before leaving after YES.
- TOP's display-size setting applies across all games in the same browser. Automatic mode uses 100% on phones and 125–150% on tablet-sized screens; manual mode supports 75–175% and a 100% reset. The preference persists locally. DRAW scales its controls while keeping drawing coordinates and document data unchanged.
- CARDS, SHAPES, DICE, ROBOTS, LINE, MEMORY LINE, SHIFT and DERBY ask for a manually selected or randomly drawn opening player at game start. CPU can go first in supported games; ROBOTS selects the first command-input player. DERBY result screens retain the final board and all six horses' scores and placings, including disqualifications.
- Waiting Line v2.3.1 preserves the v2.2 rules, adds shared names and a confirmed return to GAMES during a match, and corrects the rules text to describe simultaneous scoring for both players. Turn snapshots preserve the non-existent cells of the walls board when undoing. It is included in the launcher filters, random selection, and offline downloads. VS CPU provides standard difficulty for one human (P1) against CPU (P2). With private multipliers, the AI receives only its own multipliers and a neutral estimate for the opponent. CPU mode undo restores the previous human decision, including later CPU actions.
- The project is ready to upload to a GitHub Pages repository root.
- All current games are single-file local HTML files. No external CDN, API, image, font, or audio dependency was found.
- Offline Cache Storage is separate from each game's `localStorage` save data. Updating the offline cache does not clear existing in-game saves.
- Browser storage is not permanent. iOS Safari and Home Screen apps can manage storage separately, so save/download in the same browser or Home Screen app you plan to use offline.
- If the first offline save says the Service Worker is not ready, reload the launcher once and run the download again.

## Waiting Draw

WAITING DRAW v0.2.5をツール一覧とオフライン保存対象に追加しています。ノートはIndexedDB（`waiting-draw-v01`）に自動保存します。JSONの`waiting-draw`形式・version 1を維持し、元の共有シート・コピー・ダウンロード・ファイル／貼り付け復元を利用できます。別アプリや別ブラウザのノートは、JSONの書き出しと復元で移してください。オフライン用HTMLの更新でノートを消去しません。

## CPU戦の検証

Waiting Line v2.3.1では4隅・4壁とも、到達時に両プレイヤーが「順位の基礎点 × 各自の色倍率」で得点することを画面に明記しています。得点欄にはプレイヤー名を表示し、倍率公開時には両者の計算式も表示します。非公開時は式を隠します。

Waiting Lineの回帰テストは `node --test tests/line-cpu.test.cjs` で実行できます（追加パッケージ不要）。秘密倍率へのアクセス制限、配置・回転P、同時ゴールの順位選択、巻き戻し、予約動作の取消、先後交代、3ラウンドの集計を検証します。

## License

© 2026 TDFlll. All Rights Reserved.

Waiting Game is free to play for personal, non-commercial use. Offline downloads are permitted only through the official website's download feature for use on your own device. Sharing the official website URL is permitted.

Unauthorized copying, redistribution (including sharing downloaded offline files), publication of modified versions, and commercial use are prohibited, except where applicable law permits or the copyright holder expressly authorizes them.

See [LICENSE](LICENSE) for the full terms. This is a custom license, not an open-source license.

## Waiting Derby

The title offers Start, Options, and Quit (return to the game launcher). Options selects Free Open (manual card choice) or Randm Open (one random face-down card every five seconds). In Randm Open, the current player presses Stop to freeze the board and buy one private ticket, then passes the device. Cancelling resumes automatic opening after five seconds; rules, ticket review, handoffs, and hidden pages pause it. At nine revealed effect cards, final purchases begin with the last card still hidden. Existing ticket limits, odds, and two-round scoring remain in effect.

Run `node --test tests/derby-open-modes.test.cjs` for timer, purchase, handoff, cancellation, and Free Open regression checks.

## Waiting Shift

Waiting Shift v0.9.1 includes shared player names, a confirmed return to GAMES during a match, and offline downloads. The supplied wall/free rules, master object, slide animation, undo, and victory conditions are preserved. Run `node --test tests/shift.test.cjs` for selection rules, segment shifts, master movement, wins, and draws.

## Waiting Memory Line

Waiting Memory Line v0.5 includes shared player names and a confirmed return to GAMES during a match. The normal and advanced modes, CALL animation, undo, and first-player double-three restriction retain the supplied rules. Ownership remains hidden during play; end-of-game tiles use compact P1/P2 labels with the shared name in their tooltip.

Run `node --test tests/memory-line.test.cjs` for placement, hand refill, undo, wins, CALL, full-board draws, and basic double-three boundaries. The v0.5 advanced CALL issue is corrected: a mixed-owner five-color or five-shape line can be claimed only by the player who placed its last piece. Placement order is preserved by undo. The double-three implementation is the supplied six-cell-window rule, not a verified full Renju rules engine.
