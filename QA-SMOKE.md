# Real device smoke tests

This validation branch triggers the independent CI test job. Once published, verify:

1. Open the Pages URL in Safari on iPhone; Home > Build loads an 18×18 editor.
2. Tap **Sample maze**; select **Explore**; hold forward to move; minimap tracks position.
3. In **Scan**, upload a real board photo, mark corners TL/TR/BR/BL, sample a wood block and a paper square, and preview detection. Correct mistakes after applying.
4. In **Imagine**, place a treasure or riddle in the grid, write a message, and attach a small photo or ten-second voice recording.
5. Export the JSON, reload, and import; confirm attached media and world theme persist.
6. In **VR**, enable motion and choose landscape Cardboard; turn your head and inspect split stereoscopy.
7. On a second phone, open **Control**, connect via the displayed code, and move the host. Then try optional tilt control.
8. Toggle audio, offline mode after initial install, and the battery-saver setting.

Device-specific scanning and WebRTC success require real photographs and hardware. CI cannot validate them.
