///////////////////////////////////////////////////////////////////////////////
/// @file MinZX.js
///
/// @brief Main class for the MinZX 48K Spectrum emulator
///
/// @author David Crespo Tascon
///
/// @copyright (c) David Crespo Tascon
///  This code is released under the MIT license,
///  a copy of which is available in the associated LICENSE file,
///  or at http://opensource.org/licenses/MIT
///////////////////////////////////////////////////////////////////////////////

"use strict";

class MinZX
{
    constructor(canvasIdForScreen)
    {
        const self = this;

        // core is a set of callbacks passed to the Z80 emulator
        // for giving an environment to the processor:
        // - a memory space for reading / writing
        // - I/O ports for reading / writing
        const core = {
            mem_read  : function(addr)     { return self._mem_read (addr)    ; },
            mem_write : function(addr,val) {        self._mem_write(addr,val); },
            io_read   : function(port)     { return self._io_read  (port)    ; },
            io_write  : function(port,val) {        self._io_write (port,val); },
        };

        // create the Z80 emulator object
        this.cpu = new Z80(core);

        // create a byte array for holding 64 KB of memory
        // and initialize it to zero
        this.mem = new Uint8Array(65536);
        for (let i = 0; i < 63336; i++)
            this.mem[i] = 0;

        // create screen helper object
        this._screen = new ZXScreen(canvasIdForScreen);

        // create keyboard helper object, receiving events from window
        this._keyb = new ZXKeyboard(window);

        // create sound helper object
        this._sound = new ZXSoundOutput();

        // previous sound bit for reacting only to changes in bit
        this._prev_sound_bit = 0;

        // initially not started
        this._started = false;
    }

    start()
    {
        // don't start more than once
        if (this._started) return;

        this._start();
    }

    ////////////////////////////////////////////////////////////////////////////////
    // CORE: memory R/W, ports R/W
    ////////////////////////////////////////////////////////////////////////////////

    // read from memory at address addr, return byte at that position
    _mem_read(addr) {
        let val = this.mem[addr];
        this._emulate_contended_memory(addr);
        return val;
    }

    // write to memory at address addr, putting byte at that position
    _mem_write(addr, val) {
        // make ROM read-only
        if (addr >= 0x4000)
            this.mem[addr] = val;
        this._emulate_contended_memory(addr);
    }

    // read from Input port
    _io_read(port) {
        let val = 0xFF;
        // ULA responds to any even address
        if ((port & 1) == 0) {
            // read from keyboard
            val = this._keyb.getKeyboardValueForPort(port);
        }
        else
            val = 0;

        return val;
    }

    // write to output port
    _io_write(port, val) {
        // ULA responds to any even address
        if ((port & 1) == 0) {
            // border is set with lower 3 bits of value
            this._screen.border = val & 0x07;
            // sound is bit 4
            const sound_bit = val & 0x10 ? 1 : 0;
            if (sound_bit != this._prev_sound_bit) {
                // calculate transition time
                let ttime = this._framecount * this._frametime;
                ttime += this._cyclecount / this._cpufreq;
                // notify transition time
                this._sound.notifyTransitionTime(ttime);
                // annotate previous bit
                this._prev_sound_bit = sound_bit;
            }
        }
    }

    // reset the processor
    reset() {
        this.cpu.reset();
    }

    _emulate_contended_memory(addr) {
        if (addr >= 0x4000 && addr < 0x8000) {
            this._cyclecount += 8000;
        }
    }

    ////////////////////////////////////////////////////////////////////////////////
    // Snapshot loading
    ////////////////////////////////////////////////////////////////////////////////

    // documentation for SNA format: https://faqwiki.zxnet.co.uk/wiki/SNA_format

    loadSNA(data)
    {
        // canonic SNAs are 49152 (48KB) + 27 bytes long. Enforce it.
        if (data.length != 49179) {
            console.warn('Unexpected data length: expected 49179, got ' + data.length);
        }

        // helper for creating word from 2 bytes
        function mkword(lobyte, hibyte) { return 256*hibyte + lobyte; }

        // first 27 bytes hold register state, restore it
        const state = this.cpu.getState();
        state.pc = 0x0072;  // RETN in ROM, see SNA documentation
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
        state.iy      = mkword(data[0x0F], data[0x10]);
        state.ix      = mkword(data[0x11], data[0x12]);
        state.iff2    = data[0x13];
        state.r       = data[0x14];
        state.f       = data[0x15];
        state.a       = data[0x16];
        state.sp      = mkword(data[0x17], data[0x18]);
        state.imode   = data[0x19];
        this.cpu.setState(state);

        // last byte holds border state
        this._screen.border  = data[0x1A];
 
        // copy 48KB of data from snapshot to RAM memory
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

    _start()
    {
        // cpu frequency, in kHz
        this._cpufreq = 3500;
        
        // frame counter
        this._framecount = 0;

        // frame time, in msec (msec is the inverse of kHz)
        this._frametime = 20;

        // previous time stamp, null initially
        this._prevtime = null;

        // accumulated time, for emitting interrupt once per frame
        this._accumtime = this._frametime;

        // flash state variables
        this._flashstate  = false;  // initially not inverted
        this._flashtime   = 0;      // timestamp for inverting
        this._flashperiod = 320;    // flash period in ms

        // cycle counter and period (cycles per frame) are needed for accurate sound
        this._cyclecount = 0;
        this._cycleperiod;

        // load ROM and start animation when ROM loaded
        const self = this;
        loadRemoteBinaryFile('zx48.rom', function(data) {
            console.log('Loaded ZX Spectrum ROM: ' + data.length + ' bytes');
            for (let i = 0; i < 0x4000; i++) {
                self.mem[i] = data[i];
            }
            // after loading ROM, request first animation frame draw
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
        // on first frame, _prevtime is null.
        // on other frames, _prevtime is time of previous frame.
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
        // annotate previous time
        this._prevtime = time;

        // request another frame
        this._requestAnimation();
    }

    _onDrawFrame(time, deltatime)
    {
        // accumulate deltatime (time of previous frame)
        this._accumtime += deltatime;

        // number of cycles for given frequency and frame time
        this._cycleperiod = this._cpufreq * this._frametime;

        // if accumtime exceeds deltatime, we must draw
        while (this._accumtime >= this._frametime)
        {
            // execute instructions until max cycle count reached...
            while (this._cyclecount < this._cycleperiod) {
                this._cyclecount += this.cpu.run_instruction();
                // ... or CPU halted (with HALT instruction)
                if (this.cpu.is_halted()) {
                    break;
                }    
            }

            // cycle count must be monotonic
            this._cyclecount -= this._cycleperiod;
            
            // evaluate flash inversion flag
            this._flashtime += this._frametime;
            if (this._flashtime >= this._flashperiod) {
                this._flashtime -= this._flashperiod;
                this._flashstate = !this._flashstate;
            }

            // redraw screen
            this._screen.update(this.mem, this._flashstate);

            // emit maskable interrupt to wake up CPU from halted state
            this.cpu.interrupt(false, 0);

            // increase frame counter
            this._framecount++;

            // substract frametime from accumtime before loop restart
            this._accumtime -= this._frametime;
        }
    }
}

