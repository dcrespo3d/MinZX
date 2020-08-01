class MinZX
{
    constructor()
    {
        const self = this;
        const core = {
            mem_read  : function(addr)     { return self.mem_read (addr)    ; },
            mem_write : function(addr,val) {        self.mem_write(addr,val); },
            io_read   : function(port)     { return self.io_read  (port)    ; },
            io_write  : function(port,val) {        self.io_write (port,val); },
        };

        this.cpu = new Z80(core);

        this.mem = new Uint8Array(65536);
        for (let i = 0; i < 63336; i++)
            this.mem[i] = 0;

        this._createScreen();

        this._keyb = new ZXKeyboard(window);

     }

    ////////////////////////////////////////////////////////////////////////////////
    // CORE: memory R/W, ports R/W
    ////////////////////////////////////////////////////////////////////////////////

    mem_read(addr) {
        let val = this.mem[addr];
        return val;
    }

    mem_write(addr,val) {
        this.mem[addr] = val;
    }

    io_read(port) {
        let val = 0xFF;
        // last bit must be zero for keyboard
        if ((port & 1) == 0)
            val = this._keyb.getKeyboardValueForPort(port);
        else
            val = 0;

        return val;
    }

    io_write(port,val) {
        // TBD
    }

    reset() {
        this.cpu.reset();
    }

    loadMemory(arr, org) {
        org = org || 0;
        for (let i = 0; i < arr.length; i++) {
            this.mem[org+i] = arr[i];
        }
    }

    ////////////////////////////////////////////////////////////////////////////////
    // Screen: image from memory at graphic memory area
    ////////////////////////////////////////////////////////////////////////////////

    _createScreen()
    {
        this.scale = 2;
        this.canvas = document.getElementById('zxscr');
        this.canvas.width = 256 * this.scale;
        this.canvas.height = 192 * this.scale;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this.zxid = new ZXScreenAsImageData(this.ctx);

        this._drawScreen();
    }

    updateScreen()
    {
        let off = 0x4000;
        let scrlen = 6912;
        let scr = new Uint8Array(scrlen);
        for (let i = 0; i < scrlen; i++)
            scr[i] = this.mem[off + i];
        this.zxid.putSpectrumImage(scr, 0, this._flashstate);

        this._drawScreen();

        this.cpu.interrupt(false, 0);
    }

    _drawScreen()
    {
        // identity transform
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Draw the image data to the canvas
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, 100, 100);
        this.ctx.putImageData(this.zxid.imgdata, 0, 0);

        //let img = this.ctx.getImageData(0, 0, 256, 192);
        //console.log(img);
        this.ctx.scale(this.scale, this.scale);
        this.ctx.drawImage(this.canvas, 0, 0);
    }

    ////////////////////////////////////////////////////////////////////////////////
    // Snapshot loading
    ////////////////////////////////////////////////////////////////////////////////

    _makeWord(lobyte, hibyte) {
        return 256*hibyte + lobyte;
    }

    loadSNA(data)
    {
        if (data.length != 49179) {
            console.warn('Unexpected data length: expected 49179, got ' + data.length);
        }

        const state = this.cpu.getState();
        state.pc = 0x0072;  // RETN in ROM
        state.i       = data[0x00];
        state.l_prime = data[0x01];
        state.h_prime = data[0x02];
        state.e_prime = data[0x03];
        state.d_prime = data[0x04];
        state.c_prime = data[0x05];
        state.b_prime = data[0x06];
        state.f_prime = data[0x07];
        state.a_prime = data[0x08];
        state.l       = data[0x09];
        state.h       = data[0x0A];
        state.e       = data[0x0B];
        state.d       = data[0x0C];
        state.c       = data[0x0D];
        state.b       = data[0x0E];
        state.ix      = this._makeWord(data[0x0F], data[0x10]);
        state.iy      = this._makeWord(data[0x11], data[0x12]);
        state.iff2    = data[0x13];
        state.r       = data[0x14];
        state.f       = data[0x15];
        state.a       = data[0x16];
        state.sp      = this._makeWord(data[0x17], data[0x18]);
        this.cpu.setState(state);

        // TODO: border
        const border  = data[0x19];

        // copy 48Kb memory
        const datalen = 0xC000; // 48K
        const dataoff = 0x1B;   // 27
        const memoff  = 0x4000;  // 16K
        for (let i = 0; i < datalen; i++) {
            this.mem[memoff+i] = data[dataoff+i];
        }
    }

    ////////////////////////////////////////////////////////////////////////////////
    // Animation loop and timing
    ////////////////////////////////////////////////////////////////////////////////

    start()
    {
        // cpu frequency, in kHz
        this._cpufreq = 3500;
        
        // frame time, in msec
        this._frametime = 20;

        // previous time stamp, null initially
        this._prevtime = null;

        // accumulated time, for emitting interrupt once per frame
        this._accumtime = this._frametime;

        this._flashstate = false;
        this._flashtime = 0;
        this._flashperiod = 320;

        // load ROM and start animation when ROM loaded
        const self = this;
        loadRemoteBinaryFile('zx48.rom', function(data) {
            console.log('Loaded ZX Spectrum ROM: ' + data.length + ' bytes');
            self._rom = data;
            self.loadMemory(data);
            self._requestAnimation();
        });
    }

    _requestAnimation()
    {
        const self = this;
        requestAnimationFrame(function(time) {
            self._onAnimationFrame(time);
        });
    }

    _onAnimationFrame(time)
    {
        if (this._paused)
        {
            this._prevtime = null;
            return;
        }

        if (this._prevtime != null)
        {
            // deltatime is current timestamp minus previous
            let deltatime = time - this._prevtime;

            // detect abnormal frame time (maybe due to window hidden, or other cases)
            if (deltatime > 500)
                deltatime = this._frametime;

            // draw frame for given deltatime
            this._onDrawFrame(time, deltatime);
        }
        this._prevtime = time;

        this._requestAnimation();
    }

    _onDrawFrame(time, deltatime)
    {
        this._accumtime += deltatime;
        while (this._accumtime >= this._frametime)
        {
            let numCycles = 0;
            let maxCycles = this._cpufreq * this._frametime;
    
            while (numCycles < maxCycles) {
                numCycles += this.cpu.run_instruction();
                if (this.cpu.is_halted()) {
                    // console.log("halted");
                    break;
                }    
            }
            
            this._flashtime += this._frametime;
            if (this._flashtime >= this._flashperiod) {
                this._flashtime -= this._flashperiod;
                this._flashstate = !this._flashstate;
            }

            this.updateScreen();

            this.cpu.interrupt(false, 0);

            this._accumtime -= this._frametime;
        }
    }
}

