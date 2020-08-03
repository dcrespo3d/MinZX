# MinZX
Minimalistic ZX Spectrum 48K emulator written in JavaScript.

It has screen, keyboard and sound, and can load snapshots in SNA format.

This emulator started as a personal project with the following goals:
- Learning Z80 assembly programming.
- Learning about the architecture of the ZX Spectrum.

It gradually evolved towards a fairly complete emulator, without adding too much code complication.

The project totals ~1000 lines of code`*` (including lots of comments and empty lines), so it's great for learning how an emulator works. Its code is well structured, with separate classes for screen, keyboard, sound and core machine.

(`*`excluding `Z80.js` which emulates the Z80 CPU and has ~3400 lines of code).

[Try it here](https://dcrespo3d.github.io/MinZX/index.html). Keyboard required, not for mobile.

[![MinZX](https://dcrespo3d.github.io/MinZX/docs/MinZX.png)](https://dcrespo3d.github.io/MinZX/index.html)

## Features
- ZX Spectrum 48K emulation with original ROM.
- Screen emulation with border, BRIGHT and FLASH attributes.
- Keyboard emulation, from DOM keydown/keyup events.
- Sound emulation with 4x supersampling for clear beeper tunes.
- SNA snapshot loading from local filesystem.
- Good compatibility with LOTS of supported games (48K SNA only).
- Good timing, counting processor cycles, using vertical interrupts, and a simplistic contended memory algorithm.

### Features not implemented
- Snapshot saving (in wish list).
- Intra-frame border changes. Border is refreshed once per frame.
- Tape loading, only loading mechanism is through SNA snapshot.
- So many others...

## Thanks to

- [Molly Howell](https://github.com/DrGoldfire) for her [Z80 emulator in Javascript](https://github.com/DrGoldfire/Z80.js).
- [Amstrad PLC](http://www.amstrad.com) for the ZX Spectrum ROM binaries [liberated for emulation purposes](http://www.worldofspectrum.org/permits/amstrad-roms.txt).
- My uncle Pedro for introducing me to the [ZX81](https://en.wikipedia.org/wiki/ZX81) and the [ZX Spectrum](https://en.wikipedia.org/wiki/ZX_Spectrum).