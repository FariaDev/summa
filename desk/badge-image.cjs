// @ts-check
'use strict';

const DIGITS=[
 ['01110','11011','11011','11011','11011','11011','01110'],
 ['00100','01100','00100','00100','00100','00100','01110'],
 ['01110','11011','00011','00110','01100','11000','11111'],
 ['11110','00011','00011','01110','00011','00011','11110'],
 ['00011','00111','01111','11011','11111','00011','00011'],
 ['11111','11000','11000','11110','00011','11011','01110'],
 ['01110','11000','11000','11110','11011','11011','01110'],
 ['11111','00011','00110','00110','01100','01100','01100'],
 ['01110','11011','11011','01110','11011','11011','01110'],
 ['01110','11011','11011','01111','00011','00011','01110'],
];

/** Gera um selo BGRA sem fonte instalada, arquivo ou janela auxiliar.
 * @param {Pick<typeof import('electron').nativeImage,'createFromBitmap'>} nativeImage
 * @param {number} count inteiro entre 1 e 99
 * @returns {import('electron').NativeImage}
 * @example createBadgeImage(nativeImage,3) */
function createBadgeImage(nativeImage,count){
 const digits=String(count),scale=digits.length===1?6:4;
 const width=(digits.length*6-1)*scale,left=(64-width)/2,top=(64-7*scale)/2;
 const pixels=Buffer.alloc(64*64*4);
 for(let y=0;y<64;y++)for(let x=0;x<64;x++){
  if(Math.hypot(x-31.5,y-31.5)>31)continue;
  const column=Math.floor((x-left)/scale),row=Math.floor((y-top)/scale);
  const digit=digits[Math.floor(column/6)];
  const white=row>=0&&row<7&&column>=0&&DIGITS[Number(digit)]?.[row]?.[column%6]==='1';
  const offset=(y*64+x)*4;
  pixels[offset]=white?255:54;pixels[offset+1]=white?255:54;
  pixels[offset+2]=white?255:214;pixels[offset+3]=255;
 }
 return nativeImage.createFromBitmap(pixels,{width:64,height:64}).resize({width:16,height:16,quality:'best'});
}

module.exports={createBadgeImage};
