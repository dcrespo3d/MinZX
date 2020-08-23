///////////////////////////////////////////////////////////////////////////////
/// @file ZXKeyboard.js
///
/// @brief Keyboard abstraction for the MinZX 48K Spectrum emulator
///
/// @author David Crespo Tascon
//////
/// @copyright (c) David Crespo Tascon
///  This code is released under the MIT license,
///  a copy of which is available in the associated LICENSE file,
///  or at http://opensource.org/licenses/MIT
///////////////////////////////////////////////////////////////////////////////

"use strict";

// references:
// https://worldofspectrum.org/faq/reference/48kreference.htm
// http://www.breakintoprogram.co.uk/computers/zx-spectrum/keyboard

// This class models the ZX Spectrum keyboard.
// The Spectrum has 40 keys, which are read through 8 ports.
// Every port read produces a byte, but only lower 5 bits are used.
// The key state is active low: 1 for not pressed, 0 for pressed.
class ZXKeyboard
{
    constructor(eventReceiverElement)
    {
        this.eventReceiverElement = eventReceiverElement;

        // Table of bytes for key ports, initially all keys unpressed.
        // As keys are active low, all bits initially set to one.
        this.kbbits = {};           // 01234
        this.kbbits[0xFEFE] = 0xFF; // hZXCV
        this.kbbits[0xFDFE] = 0xFF; // ASDFG
        this.kbbits[0xFBFE] = 0xFF; // QWERT
        this.kbbits[0xF7FE] = 0xFF; // 12345
        this.kbbits[0xEFFE] = 0xFF; // 09876
        this.kbbits[0xDFFE] = 0xFF; // POIUY
        this.kbbits[0xBFFE] = 0xFF; // eLKJH
        this.kbbits[0x7FFE] = 0xFF; // syMNB
        // h = shift, e = enter, s = space, y = sym/ctrl

        // array of port numbers
        this.kbports = [];

        // keycode table which associates a keycode with a port and a bit
        this.kctable = {};

        // setup keycodes for each port
        this._setupKeys(0xFEFE, 16, 90, 88, 67, 86);
        this._setupKeys(0xFDFE, 65, 83, 68, 70, 71);
        this._setupKeys(0xFBFE, 81, 87, 69, 82, 84);
        this._setupKeys(0xF7FE, 49, 50, 51, 52, 53);
        this._setupKeys(0xEFFE, 48, 57, 56, 55, 54);
        this._setupKeys(0xDFFE, 80, 79, 73, 85, 89);
        this._setupKeys(0xBFFE, 13, 76, 75, 74, 72);
        this._setupKeys(0x7FFE, 32, 17, 77, 78, 66);

        // setup keydown and keyup events
        let self = this;
        eventReceiverElement.addEventListener('keydown', function(e) {
            const keyProcessed = self._onKey(e.keyCode, true);
            if (keyProcessed && e.preventDefault)
                e.preventDefault();
        });
        eventReceiverElement.addEventListener('keyup', function(e) {
            const keyProcessed = self._onKey(e.keyCode, false);
            if (keyProcessed && e.preventDefault)
                e.preventDefault();
        });
    }

    _setupKeys(port, kcb0, kcb1, kcb2, kcb3, kcb4)
    {
        // annotate port
        this.kbports.push(port);
        // associate, to each keycode, an array of port and bit
        this.kctable[kcb0] = [port, 0];
        this.kctable[kcb1] = [port, 1];
        this.kctable[kcb2] = [port, 2];
        this.kctable[kcb3] = [port, 3];
        this.kctable[kcb4] = [port, 4];
    }

    // handler for key events
    _onKey(keyCode, down)
    {
        // ignore keycodes absent from keycode table
        if (!(keyCode in this.kctable)) return false;

        // get port and bit for given key
        let kval = this.kctable[keyCode];
        let port = kval[0];
        let bit  = kval[1];

        // current port value
        let pval = this.kbbits[port];

        let mask = 1 << bit;
        if (down) {
            // key is down: set bit to 0
            mask = (~mask & 0xFF);
            pval = pval & mask;
        }
        else {
            // key is up: set bit to 1
            mask = mask & 0xFF;
            pval = pval | mask;
        }

        // update port value
        this.kbbits[port] = pval;

        return true;
    }

    // Get keyboard value for given port (negated masks allowed)
    // For example,
    // port FEFE (11111110...) is for left  half bottom row, and
    // port 7FFE (01111111...) is for right half bottom row.
    // If we are asked for
    // port 7EFE (01111110...) we should return a combination of both halves
    // Since keys are active low, we use an AND instead of an OR.
    getKeyboardValueForPort(port)
    {
        // initial value: no keys pressed
        let val = 0xFF;

        // traverse all values in port array
        for (let i = 0; i < this.kbports.length; i++)
        {
            // port to be tested
            let testport = this.kbports[i];
            if ((~(testport | port)) & 0xFF00) {
                // port was requested, use its value
                val &= this.kbbits[testport];
            }
        }
        return val;
    }
}
