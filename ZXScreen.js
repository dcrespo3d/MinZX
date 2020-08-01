///////////////////////////////////////////////////////////////////////////////
/// @file MinZX.js
///
/// @brief Screen abstraction for the MinZX 48K Spectrum emulator
///
/// @author David Crespo Tascon
///
/// @copyright (c) David Crespo Tascon
///  This code is released under the MIT license,
///  a copy of which is available in the associated LICENSE file,
///  or at http://opensource.org/licenses/MIT
///////////////////////////////////////////////////////////////////////////////

"use strict";

// Documentation for spectrum screen:
// http://www.breakintoprogram.co.uk/computers/zx-spectrum/screen-memory-layout

class ZXScreen
{
    constructor(canvasIdForScreen)
    {
        // initial border color: white
        this.border = 7;

        // scale factor
        this.scale = 2;

        // create canvas and context
        this.canvas = document.getElementById(canvasIdForScreen);
        this.ctx = this.canvas.getContext('2d');

        // create image data for screeen, with given border
        const xborder = 32;
        const yborder = 24;
        this.zxid = new ZXScreenAsImageData(this.ctx, xborder, yborder);

        // resize canvas using screen and scale
        this.canvas.width  = this.zxid.getWidth()  * this.scale;
        this.canvas.height = this.zxid.getHeight() * this.scale;

        // we want pixels! do not smooth them, please
        this.ctx.imageSmoothingEnabled = false;
    }

    update(mem, flashstate)
    {
        // copy screen memory
        const off = 0x4000;
        const scrlen = 6912;
        const scr = new Uint8Array(scrlen);
        for (let i = 0; i < scrlen; i++)
            scr[i] = mem[off + i];

        // generate image data from array, border and flash state
        this.zxid.putSpectrumImage(scr, this.border, flashstate);

        // set identity transform for removing previous scale factor
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Draw the image data to the canvas at 1:1 scale
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, 100, 100);
        this.ctx.putImageData(this.zxid.imgdata, 0, 0);

        // Draw canvas onto itself using scale factor
        this.ctx.scale(this.scale, this.scale);
        this.ctx.drawImage(this.canvas, 0, 0);
    }
}

// ZX Spectrum colors. Using 192 for non-bright value, 255 for bright value.
const zxcolors = [
    [  0,   0,   0, 255],
    [  0,   0, 192, 255],
    [192,   0,   0, 255],
    [192,   0, 192, 255],
    [  0, 192,   0, 255],
    [  0, 192, 192, 255],
    [192, 192,   0, 255],
    [192, 192, 192, 255],
    [  0,   0,   0, 255],
    [  0,   0, 255, 255],
    [255,   0,   0, 255],
    [255,   0, 255, 255],
    [  0, 255,   0, 255],
    [  0, 255, 255, 255],
    [255, 255,   0, 255],
    [255, 255, 255, 255]
];

class ZXScreenAsImageData
{
    constructor(ctx, xborder, yborder)
    {
        // if border not present, default to 0
        this.xborder = xborder ? xborder : 0;
        this.yborder = yborder ? yborder : 0;

        // add border to image data dimensions
        this.width = 256 + 2 * this.xborder;
        this.height = 192 + 2 * this.yborder;

        // create image data
        this.imgdata = ctx.createImageData(this.width, this.height);

        // fill image with white
        let bytecnt = this.width * this.height * 4;
        for (let i = 0; i < bytecnt; i++)
            this.imgdata.data[i] = 255;
    }

    // accessors fo actual dimensions
    getWidth () { return this.width;  }
    getHeight() { return this.height; }

    // color for bitmap bits with 0 (PAPER) value
    getAttrColorIndexForBit0(attr)
    {
        let bri = (attr & 0x40) != 0 ? 0x08 : 0x00;
        let rgb = (attr & 0x38) >> 3;
        return zxcolors[rgb | bri];
    }

    // color for bitmap bits with 0 (INK) value
    getAttrColorIndexForBit1(attr)
    {
        let bri = (attr & 0x40) != 0 ? 0x08 : 0x00;
        let rgb = (attr & 0x07);
        return zxcolors[rgb | bri];
    }

    // Generate image data for spectrum screen
    // - zxscreen: spectrum screen data (6912 btes),
    // - border: border color
    // - flashinv: indicates if flash attribute is to be inverted now
    putSpectrumImage(zxscreen, border, flashinv)
    {
        // de-interlace zx-screen to a linear bitmap
        const linscr = this.zx_row_adjust(zxscreen);

        // source and destination indices
        let isrc = 0;
        let idst = 0;

        // shortcut for image data
        const data = this.imgdata.data;

        // fill all pixels with border color
        const bcol = this.getAttrColorIndexForBit1(border & 0x07);
        const pixelcnt = this.width * this.height * 4;
        for (let i = 0; i < pixelcnt; i++) {
            data[idst++] = bcol[0];
            data[idst++] = bcol[1];
            data[idst++] = bcol[2];
            data[idst++] = bcol[3];
        }

        // calculate where to start for topleft pixel
        idst = 0;
        idst += 4 * this.yborder * this.width;
        idst += 4 * this.xborder

        // calculate how much to advance from the right end of a line
        // to the left start of the next
        const idst_extra = 4 * 2 * this.xborder;

        // traverse all 24 rows
        for (let row = 0; row < 24; row++)
        {
            // traverse 8 subrows in row
            for (let subrow = 0; subrow < 8; subrow++)
            {
                // index of attribute for first character in row
                let iatt = 6144 + 32 * row;

                // traverse 32 bitmap bytes in subrow
                for (let x = 0; x < 32; x++)
                {
                    const attr = linscr[iatt++];  // attribute
                    let   byte = linscr[isrc++];  // bitmap byte

                    // PAPER color (for bits with value 0)
                    let col0 = this.getAttrColorIndexForBit0(attr);

                    // PAPER color (for bits with value 0)
                    let col1 = this.getAttrColorIndexForBit1(attr);

                    // if attribute has FLASH, and we are in that part of cycle,
                    // invert (switch PAPER and INK colors)
                    if (flashinv && (attr & 0x80)) {
                        let aux = col0; col0 = col1; col1 = aux;
                    }

                    // traverse 8 bits in byte
                    for (let b = 0; b < 8; b++)
                    {
                        let bit = 0;
                        if ((byte & 0x80) != 0)
                            bit = 1;
                        byte <<= 1;

                        // put INK color for 1, PAPER color for 0
                        if (bit) {
                            data[idst++] = col1[0]; // r
                            data[idst++] = col1[1]; // g
                            data[idst++] = col1[2]; // b
                            data[idst++] = col1[3]; // a
                        }
                        else {
                            data[idst++] = col0[0]; // r
                            data[idst++] = col0[1]; // g
                            data[idst++] = col0[2]; // b
                            data[idst++] = col0[3]; // a
                        }
                    }
                }
                // advance to next line
                idst += idst_extra;
            }
        }
    }

    // 'deinterlace' screen rows
    zx_row_adjust(src)
    {
        // enforce screen size
        if (src.length != 6912) {
            console.log("zx_row_adjust: unexpected data length " + src.length);
            return null;
        }

        // create array for deinterlaced screen
        let dst = new Uint8Array(6912);

        // traverse all 192 rows
        for (let row = 0; row < 192; row++)
        {
            // bit juggle for calculating spectrum row index
            let rzx = ((row & 0x38) >> 3) | ((row & 0x07) << 3) | (row & 0xC0);
            let isrc = row * 32;
            let idst = rzx * 32;
            // copy row
            for (let col = 0; col < 32; col++)
                dst[idst++] = src[isrc++]
        }

        // copy attributes
        for (let i = 0; i < 768; i++)
        {
            dst[6144+i] = src[6144+i];
        }

        return dst;
    }

}
