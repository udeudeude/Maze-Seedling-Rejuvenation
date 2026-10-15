import { mapQuad, classifySamples } from './core.js';

export class PhotoScanner {
  constructor(canvas, onStatus) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.source = document.createElement('canvas');
    this.sctx = this.source.getContext('2d', { willReadFrequently: true });
    this.corners = null;
    this.floorSample = null;
    this.wallSample = null;
    this.mode = 'none';
    this.preview = null;
    this.size = 18;
    this.onStatus = onStatus;
    this.canvas.addEventListener('pointerdown', e => this.tap(e));
  }
  async load(file, size) {
    if (!file || !file.type.startsWith('image/')) throw Error('Choose a photograph.');
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(Error('Image could not be read.'));
        img.src = url;
      });
      const scale = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
      this.source.width = Math.max(1, Math.round(img.naturalWidth * scale));
      this.source.height = Math.max(1, Math.round(img.naturalHeight * scale));
      this.sctx.drawImage(img, 0, 0, this.source.width, this.source.height);
      this.size = size;
      const m = .055, w = this.source.width, h = this.source.height;
      this.corners = [{x:m*w,y:m*h},{x:(1-m)*w,y:m*h},{x:(1-m)*w,y:(1-m)*h},{x:m*w,y:(1-m)*h}];
      this.floorSample = null;
      this.wallSample = null;
      this.preview = null;
      this.mode = 'none';
      this.draw();
      this.onStatus('Photo loaded. Set the four board corners, then sample a wall and the paper floor.');
    } finally { URL.revokeObjectURL(url); }
  }
  setMode(mode) {
    if (!this.source.width) throw Error('Load a photo first.');
    this.mode = mode;
    if (mode === 'corners') this.cornerCount = 0;
    const names = { corners:'Tap board corners: top-left, top-right, bottom-right, bottom-left.',
      wall:'Tap the center of a wooden wall block.', floor:'Tap an empty paper square.' };
    this.onStatus(names[mode] || '');
    this.draw();
  }
  tap(event) {
    if (!this.source.width || this.mode === 'none') return;
    const r = this.canvas.getBoundingClientRect();
    const x = (event.clientX-r.left)/r.width*this.source.width;
    const y = (event.clientY-r.top)/r.height*this.source.height;
    const p = { x:Math.max(0,Math.min(this.source.width-1,x)),
                y:Math.max(0,Math.min(this.source.height-1,y)) };
    if (this.mode === 'corners') {
      this.corners[this.cornerCount++] = p;
      if (this.cornerCount === 4) {
        this.mode = 'none';
        this.onStatus('Board corners recorded. Now sample wall and floor colors.');
      } else this.onStatus('Corner '+this.cornerCount+'/4 set. Tap the next corner.');
    } else {
      const color = this.sample(p, 5);
      if (this.mode === 'wall') this.wallSample = color;
      if (this.mode === 'floor') this.floorSample = color;
      this.onStatus(this.mode === 'wall' ? 'Wood sample saved.' : 'Paper sample saved.');
      this.mode = 'none';
    }
    this.preview = null;
    this.draw();
  }
  sample(p, radius = 3) {
    const x = Math.max(0,Math.floor(p.x)-radius), y = Math.max(0,Math.floor(p.y)-radius);
    const width = Math.min(this.source.width-x,radius*2+1);
    const height = Math.min(this.source.height-y,radius*2+1);
    const data = this.sctx.getImageData(x,y,width,height).data;
    const rgb = [0,0,0];
    for (let j=0;j<data.length;j+=4) for(let i=0;i<3;i++) rgb[i]+=data[j+i];
    return rgb.map(n=>n/(data.length/4));
  }
  scan(cutoff = .10) {
    if (!this.corners || !this.wallSample || !this.floorSample)
      throw Error('Set four corners, wall color, and floor color first.');
    const n = this.size, cells = [], confidence = [];
    for (let y=0;y<n;y++) for (let x=0;x<n;x++) {
      let sum=0, count=0;
      // Multiple samples per tile suppress grid lines and single photo artifacts.
      for (const du of [-.16,0,.16]) for (const dv of [-.16,0,.16]) {
        const p=mapQuad(this.corners,(x+.5+du)/n,(y+.5+dv)/n);
        const c=this.sample(p,Math.max(1,Math.floor(Math.min(this.source.width,this.source.height)/n/15)));
        sum+=classifySamples(c,this.floorSample,this.wallSample,0).confidence;count++;
      }
      const score=sum/count;
      cells.push(score>cutoff);
      confidence.push(score);
    }
    this.preview = { cells,confidence };
    this.draw();
    const walls=cells.filter(Boolean).length;
    this.onStatus('Detected '+walls+' possible wall squares of '+n*n+'. Review the highlighted cells, then apply and correct by hand.');
    return this.preview;
  }
  draw() {
    if (!this.source.width) return;
    const w=this.source.width,h=this.source.height;
    this.canvas.width=w;this.canvas.height=h;
    const ctx=this.ctx;ctx.drawImage(this.source,0,0);
    if (!this.corners) return;
    ctx.lineWidth=Math.max(2,w/300);
    ctx.strokeStyle='#ffee78';ctx.fillStyle='#ffee78';
    ctx.beginPath();
    this.corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
    ctx.closePath();ctx.stroke();
    for (const [i,p] of this.corners.entries()) {
      ctx.beginPath();ctx.arc(p.x,p.y,Math.max(6,w/90),0,2*Math.PI);ctx.fill();
      ctx.fillStyle='#15253d';ctx.font=Math.max(16,w/45)+'px sans-serif';ctx.fillText(String(i+1),p.x+9,p.y-9);ctx.fillStyle='#ffee78';
    }
    if (this.mode==='corners') return;
    const n=this.size;
    ctx.strokeStyle='rgba(255,255,255,.42)';ctx.lineWidth=1.5;
    for(let i=0;i<=n;i++) {
      const u=i/n, a=mapQuad(this.corners,u,0),b=mapQuad(this.corners,u,1),
        c=mapQuad(this.corners,0,u),d=mapQuad(this.corners,1,u);
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      ctx.beginPath();ctx.moveTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.stroke();
    }
    if (!this.preview) return;
    ctx.fillStyle='rgba(35,223,156,.48)';
    for(let i=0;i<n*n;i++) if(this.preview.cells[i]) {
      let x=i%n,y=Math.floor(i/n), pts=[
        mapQuad(this.corners,x/n,y/n),mapQuad(this.corners,(x+1)/n,y/n),
        mapQuad(this.corners,(x+1)/n,(y+1)/n),mapQuad(this.corners,x/n,(y+1)/n)];
      ctx.beginPath();pts.forEach((p,j)=>j?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();
    }
  }
}
