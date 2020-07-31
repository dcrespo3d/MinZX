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
    constructor(ctx)
    {
        this.width = 256;
        this.height = 192;

        this.imgdata = ctx.createImageData(this.width, this.height);
        let bytecnt = this.width * this.height * 4;
        for (let i = 0; i < bytecnt; i++)
            this.imgdata.data[i] = 255;
    }

    getAttrColorIndexForBit0(attr)
    {
        let bri = (attr & 0x40) != 0 ? 0x08 : 0x00;
        let rgb = (attr & 0x38) >> 3;
        return zxcolors[rgb | bri];
    }

    getAttrColorIndexForBit1(attr)
    {
        let bri = (attr & 0x40) != 0 ? 0x08 : 0x00;
        let rgb = (attr & 0x07);
        return zxcolors[rgb | bri];
    }

    putSpectrumImage(zxscreen)
    {
        let linscr = this.zx_row_adjust(zxscreen);

        let isrc = 0;
        let idst = 0;

        let imgdata = this.imgdata;

        for (let row = 0; row < 24; row++)
        {
            for (let subrow = 0; subrow < 8; subrow++)
            {
                let y = (row * 32) + subrow;
                let iatt = 6144 + 32 * row;
                for (let x = 0; x < 32; x++)
                {
                    let attr = linscr[iatt++]
                    let byte = linscr[isrc++];

                    let col0 = this.getAttrColorIndexForBit0(attr);
                    let col1 = this.getAttrColorIndexForBit1(attr);

                    for (let b = 0; b < 8; b++)
                    {
                        let bit = 0;
                        if ((byte & 0x80) != 0)
                            bit = 1;
                        byte <<= 1;

                        if (bit) {
                            imgdata.data[idst++] = col1[0]; // r
                            imgdata.data[idst++] = col1[1]; // g
                            imgdata.data[idst++] = col1[2]; // b
                            imgdata.data[idst++] = col1[3]; // a
                        }
                        else {
                            imgdata.data[idst++] = col0[0]; // r
                            imgdata.data[idst++] = col0[1]; // g
                            imgdata.data[idst++] = col0[2]; // b
                            imgdata.data[idst++] = col0[3]; // a
                        }
                    }
                }
            }
        }
    }

    zx_row_adjust(src)
    {
        if (src.length != 6912) {
            console.log("zx_row_adjust: unexpected data length " + src.length);
            return null;
        }

        let dst = new Array(6912);

        for (let row = 0; row < 192; row++)
        {
            let rzx = ((row & 0x38) >> 3) | ((row & 0x07) << 3) | (row & 0xC0);
            let isrc = row * 32;
            let idst = rzx * 32;
            for (let col = 0; col < 32; col++)
                dst[idst++] = src[isrc++]
        }

        for (let i = 0; i < 768; i++)
        {
            dst[6144+i] = src[6144+i];
        }

        return dst;
    }

}
