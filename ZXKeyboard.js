class ZXKeyboard
{
    constructor(eventReceiverElement)
    {
        this.eventReceiverElement = eventReceiverElement;

        // keyboard bits
        this.kbbits = {};           // 012345
        this.kbbits[0xFEFE] = 0xFF; // hZXCV
        this.kbbits[0xFDFE] = 0xFF; // ASDFG
        this.kbbits[0xFBFE] = 0xFF; // QWERT
        this.kbbits[0xF7FE] = 0xFF; // 12345
        this.kbbits[0xEFFE] = 0xFF; // 09876
        this.kbbits[0xDFFE] = 0xFF; // POIUY
        this.kbbits[0xBFFE] = 0xFF; // eLKJH
        this.kbbits[0x7FFE] = 0xFF; // syMNB
        // h = shift, e = enter, s = space, y = sym/ctrl

        this.kbports = [];
        this.kctable = {};
        this._setupKeys(0xFEFE, 16, 90, 88, 67, 86);
        this._setupKeys(0xFDFE, 65, 83, 68, 70, 71);
        this._setupKeys(0xFBFE, 81, 87, 69, 82, 84);
        this._setupKeys(0xF7FE, 49, 50, 51, 52, 53);
        this._setupKeys(0xEFFE, 48, 57, 56, 55, 54);
        this._setupKeys(0xDFFE, 80, 79, 73, 85, 89);
        this._setupKeys(0xBFFE, 13, 76, 75, 74, 72);
        this._setupKeys(0x7FFE, 32, 17, 77, 78, 66);

        let that = this;
        eventReceiverElement.addEventListener('keydown', function(e) {
            //console.log(e);
            that._onKey(e.keyCode, true);
            if (e.preventDefault)
                e.preventDefault();
        });
        eventReceiverElement.addEventListener('keyup', function(e) {
            //console.log(e);
            that._onKey(e.keyCode, false);
            if (e.preventDefault)
                e.preventDefault();
        });
    }

    _setupKeys(port, kfb0, kfb1, kfb2, kfb3, kfb4)
    {
        this.kbports.push(port);
        this.kctable[kfb0] = [port, 0];
        this.kctable[kfb1] = [port, 1];
        this.kctable[kfb2] = [port, 2];
        this.kctable[kfb3] = [port, 3];
        this.kctable[kfb4] = [port, 4];
    }

    _onKey(keyCode, down)
    {
        if (!(keyCode in this.kctable)) return;
        let kval = this.kctable[keyCode];
        let port = kval[0];
        let bit  = kval[1];
        let pval = this.kbbits[port];
        let mask = 1 << bit;
        if (down) {
            mask = (~mask & 0xFF);
            pval = pval & mask;
        }
        else {
            mask = mask & 0xFF;
            pval = pval | mask;
        }
        this.kbbits[port] = pval;
    }

    getKeyboardValueForPort(port)
    {
        let val = 0xFF;
        for (let i = 0; i < this.kbports.length; i++)
        {
            let testport = this.kbports[i];
            if ((~(testport | port)) & 0xFF00)
                val &= this.kbbits[testport];
        }
        return val;
    }

}