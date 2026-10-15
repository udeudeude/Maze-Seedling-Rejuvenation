// Procedural audio, generated on the device. No audio downloads or tracking.
const THEMES={castle:[110,164.81],space:[55,82.41],ruins:[98,146.83],forest:[130.81,196]};
export class Soundscape {
  constructor(){this.ctx=null;this.nodes=[];this.enabled=false;this.theme='castle';}
  async toggle(theme){
    if(this.enabled){this.stop();return false}
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context)throw Error('Web Audio is unsupported on this device.');
    this.ctx ||= new Context();
    await this.ctx.resume();
    this.enabled=true;this.setTheme(theme);return true;
  }
  stop(){
    for(const node of this.nodes){try{node.osc.stop()}catch{}try{node.osc.disconnect()}catch{}try{node.gain.disconnect()}catch{}}
    this.nodes=[];this.enabled=false;
  }
  setTheme(theme){
    this.theme=theme;
    if(!this.enabled||!this.ctx)return;
    for(const node of this.nodes){try{node.osc.stop()}catch{}node.osc.disconnect();node.gain.disconnect()}
    this.nodes=[];
    const frequencies=THEMES[theme]||THEMES.castle;
    for(let i=0;i<frequencies.length;i++){
      const osc=this.ctx.createOscillator(),gain=this.ctx.createGain();
      osc.type=theme==='space'?'sine':theme==='ruins'?'triangle':'sine';
      osc.frequency.value=frequencies[i];
      gain.gain.value=i===0?.009:.004;
      osc.connect(gain);gain.connect(this.ctx.destination);osc.start();
      this.nodes.push({osc,gain});
    }
  }
  cue(event){
    if(!this.enabled||!this.ctx)return;
    const now=this.ctx.currentTime;
    const profiles={
      treasure:[660,990,.18,'sine'],exit:[440,880,.5,'sine'],trap:[180,70,.32,'sawtooth'],
      portal:[330,115,.44,'triangle'],riddle:[520,390,.22,'sine'],boost:[360,720,.18,'sine'],
      start:[300,520,.14,'sine']
    };
    const [a,b,duration,wave]=profiles[event]||profiles.start;
    const osc=this.ctx.createOscillator(),gain=this.ctx.createGain();
    osc.type=wave;osc.frequency.setValueAtTime(a,now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(25,b),now+duration);
    gain.gain.setValueAtTime(.0001,now);
    gain.gain.exponentialRampToValueAtTime(.055,now+.015);
    gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    osc.connect(gain);gain.connect(this.ctx.destination);
    osc.start(now);osc.stop(now+duration+.025);
    osc.onended=()=>{osc.disconnect();gain.disconnect()};
  }
}
