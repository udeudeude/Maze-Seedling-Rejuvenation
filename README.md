# MAZE · Seedling Rejuvenation

A new, independent, browser-based companion for the **Seedling Design Your Own Marble Maze** kit. The original companion application is discontinued. This project does not use the original app, its code, or its artwork.

**App:** https://udeudeude.github.io/Maze-Seedling-Rejuvenation/

## Features

1. **Build:** An editor on the original **18 × 18 grid** (and 12 × 12 import compatibility). Place wooden walls, starts, exits, holes, treasures, riddles, and paired secret passages.
2. **Scan assistant:** Photograph the board from above. Indicate its four corners; sample a wooden block and the paper floor; preview suggested wall squares; apply them and correct mistakes manually. This is color segmentation, **not full automatic object recognition**.
3. **Imagine:** Choose castle, starship, ancient ruins, or overgrown maze. Write custom messages for encounters and hear them using on-device speech synthesis.
4. **Explore:** First-person raycasting with textured walls, minimap, collectibles, traps, timer, touch, keyboard and optional gamepad.
5. **VR:** Cardboard stereoscopic view, device-orientation head tracking, optional auto-walk, and configurable speed. Split-screen works around Safari's limited WebXR support.
6. **Two-device controller:** Short-code pairing through public PeerJS signaling over WebRTC, with manual offer/answer fallback. In a headset, one phone hosts while another controls movement.

Mazes autosave locally. Export JSON for backup, keep named snapshots, or share layout-only URLs.

## Walkthrough

1. Build your physical maze. Seedling's original board is an **18 × 18** grid.
2. Choose **Scan**, photograph the board from overhead with diffuse light, and mark four corners clockwise from upper left.
3. Tap one wooden wall and one empty paper square to teach the scanner their colors; preview suggestions.
4. Review and correct the wall layout in **Build**. Explicitly place the start, end, and hole traps.
5. Choose a setting in **Imagine**, and customize the encounter notes.
6. Explore on the phone or choose **VR** and enable motion tracking before placing the phone in a Cardboard viewer.
7. To pair a second phone, open **Control** on both phones, host on the VR phone, and join using its code from the controller phone.

For offline use, install the app from the browser after loading it successfully once. Easy pairing requires Internet access to the public broker.

## Limitations

- Not a copy of Seedling's original art, interface, proprietary 3D assets, or computer-vision engine.
- Image recognition is a guided color-segmentation approximation and needs manual review. It detects wall candidates, not automatic starts, exits, or punched holes.
- The PeerJS signaling server is a third-party availability dependency; manual WebRTC setup is provided as a fallback.
- iOS Safari generally lacks immersive WebXR; we provide split-screen Canvas + motion orientation instead. Fullscreen and orientation permissions vary by device.
- Encounter messages currently use speech synthesis, not microphone recordings. Photos are not uploaded or included in saved maze files.
- The game is designed for performance on phones, using a lightweight Canvas renderer instead of photorealistic WebGL.

## Development

No runtime npm dependencies or build step.

```sh
npm test
python3 -m http.server 8000
```

Then visit http://localhost:8000. Camera capture and head-tracking permissions may require HTTPS (or localhost) on your device.

GitHub Pages publishes pushes to `main` after running tests. In repository settings use **Pages → Build and deployment → GitHub Actions**.

## Historical references

The original Seedling kit, including the 18×18 board size, and app features are documented by:

- https://www.vat19.com/item/design-your-own-marble-maze-virtual-reality
- https://thetoyinsider.com/design-your-own-marble-maze-review/
- https://www.deliacreates.com/seedling-make-your-own-virtual-maze-game/

Not affiliated with Seedling.
