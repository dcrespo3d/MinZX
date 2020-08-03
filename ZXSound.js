///////////////////////////////////////////////////////////////////////////////
/// @file ZXSound.js
///
/// @brief Sound/beeper abstraction for the MinZX 48K Spectrum emulator
///
/// @author David Crespo Tascon
///
/// @copyright (c) David Crespo Tascon
///  This code is released under the MIT license,
///  a copy of which is available in the associated LICENSE file,
///  or at http://opensource.org/licenses/MIT
///////////////////////////////////////////////////////////////////////////////

"use strict";

// Documentation for spectrum sound:
// http://www.breakintoprogram.co.uk/computers/zx-spectrum/sound

let theAudioContext = null;
const AudioContextClass = window.AudioContext || window.webkitAudioContext;

if (AudioContextClass) {
    theAudioContext = new AudioContextClass();
}
else {
    alert("No audio context available, no sound will be played");
}

class ZXSoundOutput
{
    constructor()
    {
        this.ctx = theAudioContext;
        if (!this.ctx) return;

        // buffer size, in samples
        // MUST BE a power of two.
        // lower sizes lead to lower latency,
        // but higher risk of skips/clicks.
        this._bufsize = 2048;

        // supersampling, for better sound quality.
        // set to 1 for no supersampling, and use integer values
        // and preferably powers of two. 4 is a good value.
        this._ssfactor = 4;

        // supersampled buffer
        if (this._ssfactor > 1)
            this._ssbuf = new Float32Array(this._ssfactor * this._bufsize);

        // create script processor.
        // deprecated, but the alternative (AudioWorkletNode)
        // is not widespread enough yet.
        this.sproc = this.ctx.createScriptProcessor(this._bufsize, 0, 1);

        // high pass filter for removing DC offset
        this.hpfilter = this.ctx.createBiquadFilter();
        this.hpfilter.type = "highpass";
        this.hpfilter.frequency.setValueAtTime(20, 0);
        this.hpfilter.Q.value = 1;

        // low pass filter for simulating speaker
        this.lpfilter = this.ctx.createBiquadFilter();
        this.lpfilter.type = "lowpass";
        this.lpfilter.frequency.setValueAtTime(4000, 0);
        // this.lpfilter.Q.value = 1;
 
        // connect nodes
        this.sproc.connect(this.hpfilter);
        this.hpfilter.connect(this.lpfilter);
        this.lpfilter.connect(this.ctx.destination);

        // setup audio process callback
        const self = this;
        this.sproc.onaudioprocess = function(event) {
            self._onAudioProcessSS(event);
        }

        // transition buffer.
        // this buffer stores timestamps (in samples)
        // of transition events (0 -> 1 or 1 -> 0)
        this._tbuf = [];

        // current bit state
        this._bit = false;

        // sample counter
        this._isample = 0;

        // variables for resyncing sample counter (after tab change, etc)
        this._mustsync = true;
        this._sync_ctr = 0;
        this._sync_max = (0.2 * this.ctx.sampleRate / this._bufsize);

        // amplitude (volume), 0 < a < 1
        this._amplitude = 0.125;

        // begin audio generation
        this.ctx.resume();
    }

    // notify bit state transition time (0 -> 1 or 1 -> 0)
    // units: MILLISECONDS
    notifyTransitionTime(ttime)
    {
        // calculate sample number for transition time
        const numsample = (ttime/1000 * this._ssfactor * this.ctx.sampleRate) | 0;
        
        // remove repeated samples (2->0, 3->1, 4->0, 5->1, 6->0)...
        const tlen = this._tbuf.length;
        if (tlen > 0 && this._tbuf[tlen-1] == numsample) {
            this._tbuf.pop();
            return;
        }

        // add sample number to transition buffer
        this._tbuf.push(numsample);
    }

    // fill one buffer with data
    _onAudioProcessSS(event)
    {
        const chdata = event.outputBuffer.getChannelData(0);

        // skip buffer if no transitions available
        if (this._tbuf.length == 0) {
            this._fillWithSilence(chdata);

            // decide if we must resync
            if (this._sync_ctr > 0) {
                this._sync_ctr--;
            }
            else {
                this._mustsync = true;
                this._sync_ctr = this._sync_max;
            }
            return;
        }

        // sample buffer to write
        let buf
        // size of sample buffer
        let bufsz;

        if (this._ssfactor > 1) {
            // supersampling
            buf = this._ssbuf;
            bufsz = this._ssfactor * this._bufsize;
        }
        else {
            // NO supersampling
            buf = chdata;
            bufsz = chdata.length;
        }

        // next transition time, in samples
        let nts = this._tbuf[0];

        // after a silence, we must resync
        if (this._mustsync) {
            this._mustsync = false;
            console.log("ZX sound resync");
            // NO // this._isample = nts - bufsz + 1;
            // last transition time, in samples
            let lts = this._tbuf[this._tbuf.length - 1];
            this._isample = lts - (1.5 * bufsz) | 0;
        }

        // populate all samples in buffer
        for (let i = 0; i < bufsz; i++)
        {
            // look for transition
            while (this._isample >= nts)
            {
                // invert bit
                this._bit = !this._bit;
                // remove first element in transition buffer and get next
                this._tbuf.shift();
                nts = this._tbuf[0];
            }
            if (this._bit) buf[i] =  this._amplitude;
            else           buf[i] = -this._amplitude;
             this._isample++;
        }

        if (this._ssfactor > 1) {
            // subsample from supersampled buffer to audio buffer
            let ssf = this._ssfactor;
            for (let i = 0; i < bufsz; i++)
            {
                let smp = 0;
                for (let j = 0; j < ssf; j++)
                    smp += buf[ssf*i + j];
                smp /= ssf;
                chdata[i] = smp;
            }
        }
    }

    _fillWithSilence(bufdata)
    {
        for (let i = 0; i < bufdata.length; i++) {
            if (this._bit) bufdata[i] =  this._amplitude;
            else           bufdata[i] = -this._amplitude;
        }
    }
}

