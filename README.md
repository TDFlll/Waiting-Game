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
│  └─ helper.html
└─ README.md
```

## Included Versions

- `games/shapes.html` from `waiting_shapes_v0_8_1_c1.html`
- `games/dice.html` from `waiting_dice_v0_3_2.html`
- `games/cards.html` from `waiting_cards_v0_6_3_v13.html`
- `games/auction.html` from `waiting_auction_v0.1_UI16.html`
- `games/robots.html` from `waiting_robots_v4.7.html`
- `games/escape.html` from `waiting_escape_prototype_v0_20.html`
- `games/helper.html` from `Board_Game_Helper_v1.01.html`
- `index.html` from `waiting_games_launcher_demo_v0_1.html`

## Offline Use

The launcher includes a PWA/offline manager for GitHub Pages.

1. Open the published site while online.
2. In `OFFLINE`, tap `全ゲームを一括ダウンロード`.
3. Wait until the status says the download is complete.
4. Use `状態更新` to confirm each game shows `保存済み`.
5. On iPhone, add the site to the Home Screen after saving if you want app-like startup.

`更新確認` reloads `offline-manifest.json` from the network and compares saved versions.
`一括更新` downloads the current offline bundle again.

## Notes

- The launcher `PLAY` buttons open the fixed game paths above.
- Each game has a small `← GAMES` link back to `../index.html`.
- The original game logic was left unchanged except for the added launcher return link.
- The project is ready to upload to a GitHub Pages repository root.
- All current games are single-file local HTML files. No external CDN, API, image, font, or audio dependency was found.
- Offline Cache Storage is separate from each game's `localStorage` save data. Updating the offline cache does not clear existing in-game saves.
- Browser storage is not permanent. iOS Safari and Home Screen apps can manage storage separately, so save/download in the same browser or Home Screen app you plan to use offline.
- If the first offline save says the Service Worker is not ready, reload the launcher once and run the download again.

## License

© 2026 TDFlll. All Rights Reserved.

Waiting Game is free to play for personal, non-commercial use. Offline downloads are permitted only through the official website's download feature for use on your own device. Sharing the official website URL is permitted.

Unauthorized copying, redistribution (including sharing downloaded offline files), publication of modified versions, and commercial use are prohibited, except where applicable law permits or the copyright holder expressly authorizes them.

See [LICENSE](LICENSE) for the full terms. This is a custom license, not an open-source license.
