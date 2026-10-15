import { cellAt } from './core.js';

const PALETTES = {
  castle: { sky:['#10172c','#465478'], floor:['#3c302b','#17191f'], wall:[153,133,116], trim:'#ffc979', name:'Enchanted Castle' },
  space: { sky:['#030913','#15204c'], floor:['#152a37','#030711'], wall:[80,141,183], trim:'#71f4ff', name:'Starship' },
  ruins: { sky:['#9d7861','#f1bf83'], floor:['#73513c','#392e30'], wall:[192,146,98], trim:'#f2d19e', name:'Ancient Ruins' },
  forest: { sky:['#163036','#528674'], floor:['#283d25','#14231a'], wall:[77,116,78], trim:'#c9f99a', name:'Overgrown Labyrinth' }
};
const IMAGE_CACHE = new Map();
function cachedImage(src) {
  if (!src) return null;
  if (!IMAGE_CACHE.has(src)) {
    const image = new Image();
    image.src = src;
    IMAGE_CACHE.set(src,image);
    if (IMAGE_CACHE.size > 40) IMAGE_CACHE.delete(IMAGE_CACHE.keys().next().value);
  }
  const image=IMAGE_CACHE.get(src);
  return image?.complete && image.naturalWidth ? image : null;
}
const FOV = 1.12;
function clamp(n,a,b){return Math.min(b,Math.max(a,n))}
function ray(board, x,y,dx,dy) {
  // Grid DDA: exact wall intersections, no slow fixed-distance stepping.
  let ix=Math.floor(x),iy=Math.floor(y), side=0;
  const deltaX=Math.abs(1/(dx||1e-9)),deltaY=Math.abs(1/(dy||1e-9));
  const stepX=dx<0?-1:1,stepY=dy<0?-1:1;
  let sx=(dx<0?x-ix:ix+1-x)*deltaX,sy=(dy<0?y-iy:iy+1-y)*deltaY;
  for (let i=0;i<board.size*3;i++){
    if(sx<sy){sx+=deltaX;ix+=stepX;side=0}else{sy+=deltaY;iy+=stepY;side=1}
    if (cellAt(board,ix+.5,iy+.5)==='wall') {
      const distance=Math.max(.04,side===0?sx-deltaX:sy-deltaY);
      const textureCoord=side===0?y+distance*dy:x+distance*dx;
      return {distance,side,coord:textureCoord-Math.floor(textureCoord)};
    }
  }
  return {distance:board.size*2,side:0,coord:0};
}
function gradient(ctx,x,y,w,h,c1,c2){
  const g=ctx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,c1);g.addColorStop(1,c2);
  ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
}
function sprites(ctx,rect,board,p,depth,palette,pitch){
  const n=board.size,halfW=rect.w, horizon=rect.y+rect.h*(.5+pitch);
  const candidates=[];
  for(let i=0;i<board.cells.length;i++){
    const type=board.cells[i];
    if(!['exit','trap','treasure','portal','riddle','boost'].includes(type))continue;
    const cx=i%n+.5-p.x,cy=Math.floor(i/n)+.5-p.y,dist=Math.hypot(cx,cy);
    if(dist>.45)candidates.push({type,dist,angle:Math.atan2(cy,cx)-p.angle,index:i});
  }
  candidates.sort((a,b)=>b.dist-a.dist);
  for(const item of candidates){
    const angle=Math.atan2(Math.sin(item.angle),Math.cos(item.angle));
    if(Math.abs(angle)>FOV*.66)continue;
    const screenX=rect.x+halfW*(.5+Math.tan(angle)/Math.tan(FOV/2)/2);
    const col=Math.floor((screenX-rect.x)/rect.strip);
    if(col<0||col>=depth.length||depth[col]<item.dist-.35)continue;
    const size=clamp(rect.h/item.dist*.23,8,rect.h*.48);
    const y=horizon+rect.h/Math.max(1,item.dist)*.22;
    const colors={exit:'#f5ca6a',trap:'#e85d8a',treasure:'#ffe073',portal:'#bc9bff',riddle:'#83e2fa',boost:'#a1fa8e'};
    ctx.save();ctx.translate(screenX,y);ctx.globalAlpha=clamp(1-item.dist/(n*1.6),.3,1);
    ctx.shadowColor=colors[item.type];ctx.shadowBlur=size*.9;
    ctx.strokeStyle=colors[item.type];ctx.fillStyle=colors[item.type];ctx.lineWidth=Math.max(2,size*.075);
    if(item.type==='exit'){
      ctx.strokeRect(-size*.34,-size*1.6,size*.68,size*1.6);
      ctx.fillRect(-size*.32,-size*.16,size*.64,size*.16);
    }else if(item.type==='portal'){
      ctx.beginPath();ctx.ellipse(0,-size*.56,size*.39,size*.64,0,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.ellipse(0,-size*.56,size*.22,size*.47,0,0,Math.PI*2);ctx.stroke();
    }else{
      ctx.beginPath();const points=item.type==='treasure'?8:4;
      for(let i=0;i<points;i++){const a=i/points*Math.PI*2,r=i%2&&points===8?size*.17:size*.35;
        const x=Math.cos(a)*r,yy=-size*.48+Math.sin(a)*r;i?ctx.lineTo(x,yy):ctx.moveTo(x,yy)}
      ctx.closePath();ctx.fill();
    }
    const picture=cachedImage(board.media?.[item.index]?.image);
    if(picture){
      const width=Math.min(size*.82,rect.w*.34),height=width*picture.naturalHeight/picture.naturalWidth;
      ctx.shadowBlur=0;ctx.globalAlpha=1;ctx.fillStyle='#ecdcac';
      ctx.fillRect(-width/2-3,-size*1.2-height-3,width+6,height+6);
      ctx.drawImage(picture,-width/2,-size*1.2-height,width,height);
    }
    ctx.restore();
  }
}
function eye(ctx,rect,board,player,palette,eyeOffset,opts){
  const {x,y,w,h}=rect;
  const pitch=clamp((player.pitch||0)/2,-.3,.3);
  const horizon=y+h*(.5+pitch);
  gradient(ctx,x,y,w,Math.max(1,horizon-y),palette.sky[0],palette.sky[1]);
  gradient(ctx,x,horizon,w,Math.max(1,y+h-horizon),palette.floor[0],palette.floor[1]);
  const floorAlpha=opts.quality==='low'?.1:.22;
  ctx.strokeStyle='rgba(240,226,193,'+floorAlpha+')';ctx.lineWidth=1;
  for(let line=1;line<11;line++){
    const t=line/11,yy=horizon+(y+h-horizon)*Math.pow(t,1.55);
    ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(x+w,yy);ctx.stroke();
  }
  const halfFov=Math.tan(FOV/2),dirX=Math.cos(player.angle),dirY=Math.sin(player.angle),
    sideX=-dirY,sideY=dirX;
  const fromX=player.x+sideX*eyeOffset,fromY=player.y+sideY*eyeOffset;
  const strip=Math.max(2,Math.floor(w/(opts.quality==='low'?110:240)));
  const depths=[];
  for(let px=0;px<w;px+=strip){
    const cameraX=(2*(px+strip/2)/w-1)*halfFov;
    const dx=dirX+sideX*cameraX,dy=dirY+sideY*cameraX;
    const hit=ray(board,fromX,fromY,dx,dy);
    const d=hit.distance;
    depths.push(d);
    const wallH=Math.min(h*2,h/(d*.71));
    const top=horizon-wallH*.5;
    const light=clamp(1/(1+d*.078),.22,1)*(hit.side?.77:1);
    const grain=hit.coord>.94||hit.coord<.03?.69:1;
    const rgb=palette.wall.map(c=>Math.round(c*light*grain));
    ctx.fillStyle='rgb('+rgb.join(',')+')';ctx.fillRect(x+px,top,strip+1,wallH);
    if(d<14){
      ctx.fillStyle='rgba(12,12,16,.24)';
      const bands=clamp(Math.floor(7/d),1,7);
      for(let k=1;k<bands;k++) {
        const yy=top+wallH*k/bands;
        ctx.fillRect(x+px,yy,strip+1,Math.max(1,wallH*.012));
      }
      if(hit.coord<.06 || hit.coord>.94){
        ctx.fillStyle='rgba(0,0,0,.18)';
        ctx.fillRect(x+px,top,strip+1,wallH);
      }
    }
  }
  sprites(ctx,{x,y,w,h,strip},board,player,depths,palette,pitch);
  ctx.save();
  ctx.strokeStyle=palette.trim;ctx.lineWidth=Math.max(1,w/370);
  ctx.globalAlpha=.75;ctx.beginPath();ctx.moveTo(x+w/2-6,y+h/2);ctx.lineTo(x+w/2+6,y+h/2);
  ctx.moveTo(x+w/2,y+h/2-6);ctx.lineTo(x+w/2,y+h/2+6);ctx.stroke();ctx.restore();
  if(opts.stereo){
    ctx.strokeStyle='#080e14';ctx.lineWidth=Math.max(5,w*.028);
    ctx.strokeRect(x+2,y+2,w-4,h-4);
  }
}

function minimap(ctx,board,player,scale,x,y){
  const n=board.size;
  ctx.save();ctx.globalAlpha=.91;ctx.fillStyle='#08101a';ctx.fillRect(x-4,y-4,n*scale+8,n*scale+8);
  for(let i=0;i<board.cells.length;i++){
    const type=board.cells[i],cx=x+i%n*scale,cy=y+Math.floor(i/n)*scale;
    ctx.fillStyle=type==='wall'?'#8c9aab':type==='start'?'#57cbaa':
      type==='exit'?'#ffc576':type==='trap'?'#d56481':type==='treasure'?'#ffdb80':'#182a3b';
    ctx.fillRect(cx,cy,scale-.3,scale-.3);
  }
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x+player.x*scale,y+player.y*scale,Math.max(2,scale*.53),0,2*Math.PI);ctx.fill();
  ctx.strokeStyle='#fff';ctx.beginPath();ctx.moveTo(x+player.x*scale,y+player.y*scale);
  ctx.lineTo(x+(player.x+Math.cos(player.angle)*1.2)*scale,y+(player.y+Math.sin(player.angle)*1.2)*scale);ctx.stroke();
  ctx.restore();
}
export function renderMaze(canvas, board, player, opts={}){
  if(!canvas||!board)return;
  const rect=canvas.getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  const ratio=Math.min(window.devicePixelRatio||1,opts.quality==='low'?1:1.8);
  const w=Math.max(1,Math.round(rect.width*ratio)),h=Math.max(1,Math.round(rect.height*ratio));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
  const ctx=canvas.getContext('2d',{alpha:false});
  const palette=PALETTES[board.theme]||PALETTES.castle;
  if(opts.stereo){
    eye(ctx,{x:0,y:0,w:w/2,h},board,player,palette,-.04,opts);
    eye(ctx,{x:w/2,y:0,w:w/2,h},board,player,palette,.04,opts);
    ctx.fillStyle='#000';ctx.fillRect(w/2-2,0,4,h);
  }else{
    eye(ctx,{x:0,y:0,w,h},board,player,palette,0,opts);
    if(opts.showMap!==false)minimap(ctx,board,player,Math.max(3,Math.min(7,w/(board.size*4))),12,12);
  }
}
export { PALETTES };
