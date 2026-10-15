import { DEFAULT_SIZE, CELL_TYPES, THEMES, createBoard, exampleBoard, normalizeBoard,
  paintCell, passable, findPath, startPosition, cellAt } from './core.js';
import { PhotoScanner } from './scanner.js';
import { renderMaze } from './renderer.js';
import { Soundscape } from './audio.js';

const $ = id => document.getElementById(id);
const soundscape=new Soundscape();
const PRIMARY_KEY='maze-seedling-board-v2', LIBRARY_KEY='maze-seedling-library-v2';
const ICONS={empty:'',wall:'',start:'S',exit:'E',trap:'×',treasure:'✦',portal:'◉',riddle:'?',boost:'↟'};
let board,brush='wall',screen='build',history=[],player,scanner,
    initialTime=performance.now(),seconds=0,finished=false,collected=new Set(),lastTile=-1,
    showMap=true,headEnabled=false,yawZero=null,currentYaw=null,vrAuto=false,
    activeControls=new Set(),remoteControls=new Set(),lastFrame=performance.now(),
    peer=null,rtc=null,dataChannel=null,hostMode=false,controllerMode=false,
    remoteTilt={x:0,y:0},tiltEnabled=false,tiltNeutral=null,lastTilt=null,lastTiltSent=0,
    boostUntil=0;

const safeStorage = {
  read(key){try{return localStorage.getItem(key)}catch{return null}},
  write(key,value){try{localStorage.setItem(key,value);return true}catch{notify('Local storage is full or blocked. Export your maze to keep it.');return false}}
};
function notify(s){$('toast').textContent=String(s);clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('toast').textContent='',7200)}
function loadStart(){
  try{
    const saved=safeStorage.read(PRIMARY_KEY)||safeStorage.read('seedling-maze-v1');
    if(saved)return normalizeBoard(JSON.parse(saved));
  }catch(e){console.warn('Stored board invalid:',e)}
  return exampleBoard();
}
board=loadStart();player=startPosition(board);
scanner=new PhotoScanner($('photoCanvas'),notify);
function persist(){
  safeStorage.write(PRIMARY_KEY,JSON.stringify(board));
  $('mazeTitle').value=board.title;$('gridSize').value=String(board.size);
}
function updatePath(){
  const route=findPath(board);
  $('pathStatus').textContent=route?'✓ Start to exit: '+(route.length-1)+' steps':'⚠ No route to the exit. Try removing walls.';
  $('pathStatus').style.color=route?'#a5efc5':'#ffbcb0';
}
function gridDraw(){
  const g=$('grid');g.style.setProperty('--size',board.size);
  const frag=document.createDocumentFragment();
  board.cells.forEach((cell,i)=>{
    const tile=document.createElement('button');
    tile.type='button';tile.className='tile '+cell;tile.dataset.index=i;tile.textContent=ICONS[cell];
    tile.title=cell+' · column '+(i%board.size+1)+', row '+(Math.floor(i/board.size)+1);
    tile.setAttribute('aria-label',tile.title);
    frag.appendChild(tile);
  });
  g.replaceChildren(frag);updatePath();
}
function afterBoardChange(redraw=true){persist();if(redraw)gridDraw();refreshObjects();}
function setBoard(next){board=normalizeBoard(next);history.length=0;resetGame();afterBoardChange();selectTheme();}
function undo(){if(!history.length)return notify('Nothing to undo.');board=history.pop();afterBoardChange();resetGame();}
$('undoBtn').onclick=undo;
function paint(index){
  const next=paintCell(board,index,brush);
  if(next===board)return;
  board=next;afterBoardChange();
}
function selectBrush(type){
  brush=type;
  document.querySelectorAll('[data-brush]').forEach(b=>b.classList.toggle('selected',b.dataset.brush===type));
}
document.querySelectorAll('[data-brush]').forEach(b=>b.onclick=()=>selectBrush(b.dataset.brush));
let dragging=false,lastPaint=-1;
const grid=$('grid');
function tileFromEvent(e){
  const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.tile');
  return target&&grid.contains(target)?Number(target.dataset.index):-1;
}
grid.addEventListener('pointerdown',e=>{
  const i=tileFromEvent(e);if(i<0)return;
  e.preventDefault();dragging=true;lastPaint=i;
  history.push(normalizeBoard(board));if(history.length>40)history.shift();
  paint(i);
});
window.addEventListener('pointermove',e=>{
  if(!dragging||!['wall','empty','trap','treasure','portal','boost','riddle'].includes(brush))return;
  const i=tileFromEvent(e);if(i<0||i===lastPaint)return;lastPaint=i;paint(i);
},{passive:true});
window.addEventListener('pointerup',()=>dragging=false);
window.addEventListener('pointercancel',()=>dragging=false);
$('mazeTitle').addEventListener('change',e=>{board.title=e.target.value.slice(0,80)||'My Maze';persist();});
$('gridSize').addEventListener('change',e=>{
  const n=Number(e.target.value);
  if(n===board.size)return;
  if(!confirm('Changing grid size starts a new maze. Export your current maze first if needed. Continue?')){
    e.target.value=String(board.size);return;
  }
  setBoard(createBoard(n));
});
$('sampleBtn').onclick=()=>{
  if(confirm('Replace this maze with the demo? Save a copy first if needed.'))setBoard(exampleBoard());
};
function resetGame(){
  player=startPosition(board);seconds=0;finished=false;collected.clear();lastTile=-1;
  initialTime=performance.now();boostUntil=0;$('timer').textContent='00:00';$('inventory').textContent='✦ 0';activeControls.clear();
}
$('restartBtn').onclick=()=>{resetGame();notify('Back at the entrance.')};
$('mapBtn').onclick=()=>{showMap=!showMap;$('mapBtn').textContent='Map: '+(showMap?'on':'off')};
async function toggleSound(){
  try{
    const on=await soundscape.toggle(board.theme);
    $('soundBtn').textContent='Sound: '+(on?'on':'off');
    $('vrSoundBtn').textContent='Sound: '+(on?'on':'off');
  }catch(err){notify(err.message)}
}
$('soundBtn').onclick=toggleSound;
$('vrSoundBtn').onclick=toggleSound;

function toScreen(s){
  screen=s;document.querySelectorAll('.screen').forEach(el=>el.classList.toggle('hidden',el.id!==s));
  document.querySelectorAll('[data-screen]').forEach(el=>el.classList.toggle('active',el.dataset.screen===s));
  if(s==='decorate'){refreshObjects();selectTheme()}
  if(s==='scan'&&scanner.source.width)scanner.draw();
  if(s==='vr')notify('Landscape orientation recommended. Enable motion to look around.');
  window.scrollTo({top:0,behavior:'instant'});
}
document.querySelectorAll('[data-screen]').forEach(b=>b.onclick=()=>toScreen(b.dataset.screen));
$('helpBtn').onclick=()=>$('helpDialog').showModal();
$('closeHelp').onclick=()=>$('helpDialog').close();

function library(){try{const a=JSON.parse(safeStorage.read(LIBRARY_KEY)||'[]');return Array.isArray(a)?a:[]}catch{return []}}
function refreshLibrary(){
  const select=$('boardsList');select.replaceChildren();
  const items=library();
  if(!items.length){let o=new Option('No saved copies','');select.add(o)}
  else items.forEach((item,i)=>select.add(new Option(item.title+' · '+new Date(item.date).toLocaleDateString(),String(i))));
}
$('saveBoardBtn').onclick=()=>{
  const list=library(),copy=normalizeBoard(board);
  list.unshift({title:copy.title,board:copy,date:Date.now()});
  if(safeStorage.write(LIBRARY_KEY,JSON.stringify(list.slice(0,30)))){refreshLibrary();notify('Saved a copy of '+copy.title+'.')}
};
$('loadBoardBtn').onclick=()=>{
  const entry=library()[Number($('boardsList').value)];
  if(entry&&confirm('Load saved maze? Current unsaved changes will be replaced.')){setBoard(entry.board);notify('Loaded '+board.title+'.')}
};
$('deleteBoardBtn').onclick=()=>{
  const list=library(),i=Number($('boardsList').value);
  if(list[i]&&confirm('Delete saved copy "'+list[i].title+'"?')){list.splice(i,1);safeStorage.write(LIBRARY_KEY,JSON.stringify(list));refreshLibrary()}
};
function download(name,contents,type){
  const link=document.createElement('a'),url=URL.createObjectURL(new Blob([contents],{type}));
  link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('exportBtn').onclick=()=>download((board.title||'maze').replace(/[^a-z0-9_-]/gi,'-')+'.json',
  JSON.stringify(board,null,2),'application/json');
$('importFile').onchange=async e=>{
  try{
    const f=e.target.files[0];if(!f)return;
    if(f.size>2_000_000)throw Error('This maze file is too large.');
    const data=JSON.parse(await f.text());setBoard(data);notify('Maze imported.');
  }catch(err){notify('Import failed: '+err.message)}finally{e.target.value=''}
};
function shareCode(){
  const chars=CELL_TYPES.map((_,i)=>i.toString(36));
  const packed=[board.size,THEMES.indexOf(board.theme),board.cells.map(c=>chars[CELL_TYPES.indexOf(c)]).join('')].join('.');
  return btoa(packed).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function fromShareCode(code){
  if(!/^[A-Za-z0-9_-]{10,1000}$/.test(code))throw Error('Invalid maze link.');
  const str=atob(code.replace(/-/g,'+').replace(/_/g,'/'));
  const [size,theme,cells]=str.split('.');
  const n=Number(size),t=Number(theme);
  if(!Number.isInteger(n)||n<6||n>24||!cells||cells.length!==n*n)throw Error('Invalid shared maze dimensions.');
  return normalizeBoard({version:2,size:n,title:'Shared Maze',theme:THEMES[t],cells:[...cells].map(c=>CELL_TYPES[parseInt(c,36)])});
}
$('shareBtn').onclick=async()=>{
  const url=new URL(location.href);url.searchParams.set('maze',shareCode());
  try{await navigator.clipboard.writeText(url.href);notify('Shareable maze URL copied.')}catch{
    window.prompt('Copy your maze link:',url.href);
  }
};
try{
  const code=new URL(location.href).searchParams.get('maze');
  if(code&&confirm('Open the maze shared in this link? Your current maze is preserved until you save.')){
    board=fromShareCode(code);resetGame();persist();
    history.length=0;notify('Shared maze loaded.');
  }
}catch(e){notify('Could not open shared maze: '+e.message)}
$('photoFile').onchange=async e=>{
  try{await scanner.load(e.target.files[0],board.size);$('applyScanBtn').disabled=true}
  catch(err){notify(err.message)}
  finally{e.target.value=''}
};
for(const [id,mode] of [['cornersBtn','corners'],['wallSampleBtn','wall'],['floorSampleBtn','floor']]){
  $(id).onclick=()=>{try{scanner.setMode(mode)}catch(e){notify(e.message)}};
}
$('threshold').oninput=e=>$('thresholdLabel').textContent=e.target.value+'%';
$('detectBtn').onclick=()=>{
  try{scanner.size=board.size;scanner.scan(Number($('threshold').value)/100);$('applyScanBtn').disabled=false}
  catch(e){notify(e.message)}
};
$('applyScanBtn').onclick=()=>{
  const scan=scanner.preview;if(!scan)return;
  history.push(normalizeBoard(board));
  const next={...board,cells:[...board.cells]};
  let hits=0;
  scan.cells.forEach((wall,i)=>{
    const old=next.cells[i];
    if(old==='start'||old==='exit'||old==='trap'||old==='treasure'||old==='portal'||old==='riddle'||old==='boost')return;
    next.cells[i]=wall?'wall':'empty';if(wall)hits++;
  });
  // Keep the physical wooden outer border even if the photograph crops it.
  for(let x=0;x<board.size;x++)for(const y of [0,board.size-1])next.cells[y*board.size+x]='wall';
  for(let y=0;y<board.size;y++)for(const x of [0,board.size-1])next.cells[y*board.size+x]='wall';
  board=normalizeBoard(next);afterBoardChange();toScreen('build');
  notify('Applied '+hits+' possible walls. Please correct the layout and mark any holes.');
};
function selectTheme(){
  document.querySelectorAll('[data-theme]').forEach(b=>b.classList.toggle('selected',b.dataset.theme===board.theme));
}
document.querySelectorAll('[data-theme]').forEach(b=>b.onclick=()=>{
  board.theme=b.dataset.theme;persist();selectTheme();soundscape.setTheme(board.theme);notify('World: '+b.querySelector('strong').textContent);
});
function refreshObjects(){
  const select=$('objectSelect'),selected=select.value;
  select.replaceChildren();
  for(let i=0;i<board.cells.length;i++){
    const type=board.cells[i];
    if(!['treasure','portal','trap','riddle','boost','exit'].includes(type))continue;
    select.add(new Option(type+' · row '+(Math.floor(i/board.size)+1)+', column '+(i%board.size+1),String(i)));
  }
  if(!select.options.length)select.add(new Option('Place an object in Build first',''));
  if([...select.options].some(o=>o.value===selected))select.value=selected;
  $('objectNote').value=board.notes[select.value]||'';
  $('objectAnswer').value=board.answers?.[select.value]||'';
  $('answerWrap').classList.toggle('hidden',board.cells[Number(select.value)]!=='riddle');
  refreshMedia();
}
$('objectSelect').onchange=()=>{$('objectNote').value=board.notes[$('objectSelect').value]||'';$('objectAnswer').value=board.answers?.[$('objectSelect').value]||'';$('answerWrap').classList.toggle('hidden',board.cells[Number($('objectSelect').value)]!=='riddle');refreshMedia()};
$('saveNoteBtn').onclick=()=>{
  const key=$('objectSelect').value;if(!key||!/^\d+$/.test(key))return notify('Place an object first.');
  board.notes[key]=$('objectNote').value.slice(0,500);
  board.answers ||= {};if(board.cells[Number(key)]==='riddle')board.answers[key]=$('objectAnswer').value.slice(0,100);
  persist();notify('Encounter saved.');
};
function selectedObject(){const k=$('objectSelect').value;return /^\d+$/.test(k)?Number(k):null}
function refreshMedia(){
  const key=selectedObject(),media=key===null?null:board.media?.[key];
  const img=$('picturePreview');
  if(media?.image){img.src=media.image;img.classList.remove('hidden')}
  else{img.removeAttribute('src');img.classList.add('hidden')}
  $('playRecordingBtn').disabled=!media?.audio;
  $('removePhotoBtn').disabled=!media?.image;
  $('removeRecordingBtn').disabled=!media?.audio;
}
function setMedia(field,data){
  const key=selectedObject();if(key===null)return notify('Place and select an encounter first.');
  if(!board.media)board.media={};
  const before=board.media[key]?{...board.media[key]}:{};
  const next={...before};
  if(data)next[field]=data;else delete next[field];
  if(Object.keys(next).length)board.media[key]=next;else delete board.media[key];
  if(JSON.stringify(board).length>2_000_000){
    if(Object.keys(before).length)board.media[key]=before;else delete board.media[key];
    return notify('Media storage limit reached. Try a shorter recording or smaller picture.');
  }
  persist();refreshMedia();
  notify(data?'Encounter '+field+' saved in maze.':'Encounter '+field+' removed.');
}
$('objectPhoto').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
    if(!file.type.startsWith('image/'))throw Error('Select a photograph.');
    const url=URL.createObjectURL(file);
    try{
      const img=new Image();
      await new Promise((resolve,reject)=>{
        img.onload=resolve;img.onerror=()=>reject(Error('Cannot read picture.'));img.src=url;
      });
      const max=480,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
      const can=document.createElement('canvas');
      can.width=Math.max(1,Math.round(img.naturalWidth*scale));
      can.height=Math.max(1,Math.round(img.naturalHeight*scale));
      can.getContext('2d').drawImage(img,0,0,can.width,can.height);
      setMedia('image',can.toDataURL('image/jpeg',.7));
    }finally{URL.revokeObjectURL(url)}
  }catch(err){notify(err.message)}finally{e.target.value=''}
};
$('removePhotoBtn').onclick=()=>setMedia('image',null);
$('removeRecordingBtn').onclick=()=>setMedia('audio',null);
$('playRecordingBtn').onclick=()=>{
  const data=board.media?.[selectedObject()]?.audio;
  if(data)new Audio(data).play().catch(()=>notify('Audio playback requires a tap on this device.'));
};
let recorder=null,recordTimeout=null;
$('recordBtn').onclick=async()=>{
  if(recorder?.state==='recording'){recorder.stop();return}
  try{
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Microphone recording is not supported here.');
    if(selectedObject()===null)throw Error('Choose an encounter first.');
    const target=selectedObject();
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    const mime=['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(m=>MediaRecorder.isTypeSupported?.(m));
    recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
    const chunks=[];recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
    recorder.onstop=()=>{
      clearTimeout(recordTimeout);$('recordBtn').textContent='Record voice (10s)';
      stream.getTracks().forEach(track=>track.stop());
      const blob=new Blob(chunks,{type:(recorder.mimeType||'audio/webm').split(';')[0]});
      if(blob.size>380_000)return notify('Recording too large. Try a shorter clip.');
      const reader=new FileReader();reader.onload=()=>{
        const old=$('objectSelect').value;
        $('objectSelect').value=String(target);
        setMedia('audio',reader.result);
        $('objectSelect').value=old;
        refreshMedia();
      };reader.readAsDataURL(blob);
    };
    recorder.start();$('recordBtn').textContent='Stop recording';
    recordTimeout=setTimeout(()=>{if(recorder?.state==='recording')recorder.stop()},10000);
    notify('Recording… up to 10 seconds.');
  }catch(err){notify('Recording unavailable: '+err.message)}
};
function showEncounter(index,message){
  const card=$('encounterCard'),media=board.media?.[index];
  $('encounterText').textContent=message||'You discovered something.';
  if(media?.image){$('encounterImage').src=media.image;$('encounterImage').classList.remove('hidden')}
  else{$('encounterImage').removeAttribute('src');$('encounterImage').classList.add('hidden')}
  if(screen==='explore'&&(media?.image||message))card.classList.remove('hidden');
  if(media?.audio)new Audio(media.audio).play().catch(()=>notify('Tap to play audio in Imagine.'));
}
$('closeEncounterBtn').onclick=()=>$('encounterCard').classList.add('hidden');

function speak(message){
  if(!('speechSynthesis' in window))return notify('Speech not available on this device.');
  speechSynthesis.cancel();const utter=new SpeechSynthesisUtterance(message);utter.rate=.9;speechSynthesis.speak(utter);
}
$('speakBtn').onclick=()=>speak($('objectNote').value||'Your story begins here.');
function move(fwd,strafe){
  const dx=Math.cos(player.angle)*fwd-Math.sin(player.angle)*strafe;
  const dy=Math.sin(player.angle)*fwd+Math.cos(player.angle)*strafe;
  if(passable(board,player.x+dx,player.y,.14))player.x+=dx;
  if(passable(board,player.x,player.y+dy,.14))player.y+=dy;
  let tile=Math.floor(player.y)*board.size+Math.floor(player.x);
  if(tile!==lastTile){lastTile=tile;encounter(tile)}
}
let activeRiddle=-1;
$('solveRiddleBtn').onclick=()=>{
  if(activeRiddle<0)return;
  const correct=String(board.answers?.[activeRiddle]||'').trim().toLocaleLowerCase();
  const guess=$('riddleGuess').value.trim().toLocaleLowerCase();
  if(correct&&guess===correct){
    collected.add(activeRiddle);$('inventory').textContent='✦ '+collected.size;
    soundscape.cue('treasure');notify('Correct! You solved the riddle.');
    $('riddleDialog').close();activeRiddle=-1;
  }else notify('Not quite. Try another answer or keep exploring.');
};
$('skipRiddleBtn').onclick=()=>{$('riddleDialog').close();activeRiddle=-1};
function encounter(tile){
  const type=board.cells[tile],note=board.notes[tile];
  if(!['empty','wall','start'].includes(type))soundscape.cue(type);
  if(type==='start'||type==='empty')return;
  if(type==='treasure'||type==='boost'){
    if(collected.has(tile))return;
    collected.add(tile);$('inventory').textContent='✦ '+collected.size;
    if(type==='boost'){boostUntil=performance.now()+12000;notify('Speed boost! 12 seconds.')}
  }
  if(type==='trap'){
    notify(note||'A trap! Back to the entrance.');
    const pos=startPosition(board);player.x=pos.x;player.y=pos.y;lastTile=-1;return;
  }
  if(type==='portal'){
    const pair=board.cells.findIndex((v,i)=>v==='portal'&&i!==tile);
    if(pair>=0){player.x=pair%board.size+.5;player.y=Math.floor(pair/board.size)+.5;lastTile=pair;}
  }
  if(type==='exit'){
    if(!finished){
      finished=true;const time=Math.floor(seconds);
      notify((note||'You escaped the maze!')+' Time: '+time+'s. Treasures: '+collected.size+'.');showEncounter(tile,note||'You escaped the maze!');
    }return;
  }
  const defaults={treasure:'You found a treasure!',riddle:'A mysterious riddle awaits.',portal:'A secret passage!',boost:'You found a power-up!'};
  const line=note||defaults[type];if(line){notify(line);showEncounter(tile,line);if(note&&type==='riddle'&&!board.media?.[tile]?.audio)speak(note)}
  if(type==='riddle'&&board.answers?.[tile]&&!collected.has(tile)&&screen==='explore'){
    activeRiddle=tile;$('riddleQuestion').textContent=line||'Solve this riddle.';
    $('riddleGuess').value='';$('riddleDialog').showModal();
  }
}
function commandPressed(name,pressed){
  if(!['forward','back','left','right'].includes(name))return;
  if(controllerMode&&dataChannel?.readyState==='open'){
    dataChannel.send(JSON.stringify({kind:'control',name,pressed}));return;
  }
  if(pressed)activeControls.add(name);else activeControls.delete(name);
}
function impulse(name){
  if(controllerMode&&dataChannel?.readyState==='open'){
    dataChannel.send(JSON.stringify({kind:'impulse',name}));return;
  }
  if(name==='left')player.angle-=.12;
  if(name==='right')player.angle+=.12;
  if(name==='forward')move(.17,0);
  if(name==='back')move(-.17,0);
}
for(const button of document.querySelectorAll('[data-control]')){
  let start=0,isDown=false;
  const name=button.dataset.control;
  button.addEventListener('pointerdown',e=>{
    e.preventDefault();button.setPointerCapture?.(e.pointerId);
    isDown=true;start=performance.now();commandPressed(name,true);
  });
  const stop=e=>{
    if(!isDown)return;isDown=false;commandPressed(name,false);
    if(performance.now()-start<155)impulse(name);
  };
  button.addEventListener('pointerup',stop);
  button.addEventListener('pointercancel',stop);
  button.addEventListener('lostpointercapture',stop);
}
const keyMap={ArrowUp:'forward',w:'forward',ArrowDown:'back',s:'back',
  ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right'};
window.addEventListener('keydown',e=>{
  if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))return;
  const name=keyMap[e.key];if(!name)return;e.preventDefault();
  if(!e.repeat)commandPressed(name,true);
});
window.addEventListener('keyup',e=>{const name=keyMap[e.key];if(name){e.preventDefault();commandPressed(name,false)}});
window.addEventListener('blur',()=>{activeControls.clear();remoteControls.clear();remoteTilt={x:0,y:0}});
$('actionBtn').onclick=()=>{if(controllerMode&&dataChannel?.readyState==='open')
  dataChannel.send(JSON.stringify({kind:'stop'}));else{activeControls.clear();remoteControls.clear();notify('Stopped.')}};
$('view').addEventListener('pointerdown',e=>{
  const r=e.target.getBoundingClientRect();
  impulse(e.clientX<r.left+r.width/2?'left':'right');
});
$('autoWalk').onchange=e=>{vrAuto=e.target.checked};
$('enableMotionBtn').onclick=async()=>{
  try{
    if(!('DeviceOrientationEvent' in window))throw Error('This browser has no orientation sensor API.');
    if(typeof DeviceOrientationEvent.requestPermission==='function'){
      const state=await DeviceOrientationEvent.requestPermission();
      if(state!=='granted')throw Error('Motion permission declined.');
    }
    headEnabled=true;yawZero=null;notify('Motion active. Face forward and tap Recenter direction.');
  }catch(e){notify(e.message)}
};
$('recenterBtn').onclick=()=>{yawZero=currentYaw;player.angle=0;player.pitch=0;notify('Head direction recentered.')};
window.addEventListener('deviceorientation',e=>{
  if(!headEnabled||e.alpha===null||e.alpha===undefined)return;
  const heading=e.alpha*Math.PI/180;
  if(currentYaw===null)currentYaw=heading;
  const change=Math.atan2(Math.sin(heading-currentYaw),Math.cos(heading-currentYaw));
  // Incrementally adjust to avoid wraparound at north.
  if(screen==='vr'&&Math.abs(change)<.8)player.angle-=change;
  currentYaw=heading;
  if(Number.isFinite(e.beta))player.pitch=Math.max(-.24,Math.min(.24,e.beta*Math.PI/360));
});
$('fullscreenBtn').onclick=async()=>{
  try{
    if(screen!=='vr')toScreen('vr');
    await ($('stereo').requestFullscreen?.()||Promise.reject(Error('Browser denies fullscreen.')));
    window.screen.orientation?.lock?.('landscape').catch(()=>{});
  }catch{notify('Fullscreen unavailable. Rotate to landscape and try Add to Home Screen.')}
};

function bindConnection(connection){
  dataChannel=connection;
  connection.onopen=()=>{
    $('connectionStatus').textContent=(controllerMode?'Connected to maze.':'Controller connected.')+' Ready to play.';
    notify('Controller connected.');
  };
  connection.onclose=()=>{$('connectionStatus').textContent='Disconnected';activeControls.clear();remoteControls.clear();remoteTilt={x:0,y:0}};
  connection.onerror=()=>{$('connectionStatus').textContent='Connection error. Try pairing again.'};
  connection.onmessage=e=>{
    if(!hostMode)return;
    try{
      const data=typeof e.data==='string'?JSON.parse(e.data):e.data;
      if(data.kind==='control'&&['left','right','forward','back'].includes(data.name)){
        data.pressed?remoteControls.add(data.name):remoteControls.delete(data.name);
      }
      if(data.kind==='impulse')impulse(data.name);
      if(data.kind==='tilt'&&Number.isFinite(data.x)&&Number.isFinite(data.y))remoteTilt={x:Math.max(-1,Math.min(1,data.x)),y:Math.max(-1,Math.min(1,data.y))};
      if(data.kind==='stop'){remoteControls.clear();remoteTilt={x:0,y:0}};
    }catch(err){console.warn('Unrecognized control message',err)}
  };
}
function newRTC(){
  rtc?.close();rtc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
  rtc.onconnectionstatechange=()=>$('connectionStatus').textContent='Connection: '+rtc.connectionState;
  rtc.ondatachannel=e=>bindConnection(e.channel);
}
async function waitICE(){
  if(rtc.iceGatheringState==='complete')return;
  await Promise.race([new Promise(resolve=>{
    rtc.addEventListener('icegatheringstatechange',function listener(){
      if(rtc.iceGatheringState==='complete'){rtc.removeEventListener('icegatheringstatechange',listener);resolve()}
    });
  }),new Promise(resolve=>setTimeout(resolve,8000))]);
}
$('offerBtn').onclick=async()=>{
  try{
    hostMode=true;controllerMode=false;newRTC();bindConnection(rtc.createDataChannel('maze-control'));
    await rtc.setLocalDescription(await rtc.createOffer());await waitICE();
    $('signalBox').value=JSON.stringify(rtc.localDescription);
    notify('Offer created. Copy it to your controller device.');
  }catch(e){notify(e.message)}
};
$('acceptBtn').onclick=async()=>{
  try{
    controllerMode=true;hostMode=false;const offer=JSON.parse($('signalBox').value);
    if(offer.type!=='offer')throw Error('Paste a host offer first.');
    newRTC();await rtc.setRemoteDescription(offer);
    await rtc.setLocalDescription(await rtc.createAnswer());await waitICE();
    $('signalBox').value=JSON.stringify(rtc.localDescription);
    notify('Answer created. Copy it back to the host.');
  }catch(e){notify(e.message)}
};
$('answerBtn').onclick=async()=>{
  try{
    if(!rtc||!hostMode)throw Error('Create a host offer first.');
    const ans=JSON.parse($('signalBox').value);
    if(ans.type!=='answer')throw Error('Paste an answer here.');
    await rtc.setRemoteDescription(ans);notify('Pairing in progress.');
  }catch(e){notify(e.message)}
};
$('copySignalBtn').onclick=async()=>{
  try{await navigator.clipboard.writeText($('signalBox').value);notify('Signaling data copied.')}
  catch{window.prompt('Copy signaling data:',$('signalBox').value)}
};
function peerLibrary(){
  if(window.Peer)return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js';
    script.onload=resolve;script.onerror=()=>reject(Error('Easy pairing service unavailable. Use Advanced pairing.'));
    document.head.appendChild(script);
  });
}
function preparePeer(role){
  peer?.destroy();try{dataChannel?.close?.()}catch{}
  dataChannel=null;remoteControls.clear();remoteTilt={x:0,y:0};
  controllerMode=role==='controller';hostMode=role==='host';
}
$('easyHostBtn').onclick=async()=>{
  try{
    await peerLibrary();preparePeer('host');
    const code='maze-'+Math.random().toString(36).slice(2,8);
    peer=new Peer(code,{debug:0});
    peer.on('open',id=>{$('peerCode').value=id;$('connectionStatus').textContent='Host code: '+id+' · Waiting for controller'});
    peer.on('connection',con=>{
      $('connectionStatus').textContent='Controller joining…';
      con.on('open',()=>bindConnection(con));con.on('data',data=>dataChannel?.onmessage?.({data}));
    });
    peer.on('error',err=>notify('Pairing error: '+err.message));
  }catch(e){notify(e.message)}
};
$('easyJoinBtn').onclick=async()=>{
  try{
    const id=$('peerCode').value.trim();
    if(!/^maze-[a-z0-9]{6}$/.test(id))throw Error('Enter the host code.');
    await peerLibrary();preparePeer('controller');
    peer=new Peer(undefined,{debug:0});
    peer.on('open',()=>{
      const con=peer.connect(id,{reliable:true});
      con.on('open',()=>bindConnection(con));con.on('data',data=>dataChannel?.onmessage?.({data}));
      con.on('error',e=>notify('Connection error: '+e.message));
    });
    peer.on('error',err=>notify('Pairing error: '+err.message));
    $('connectionStatus').textContent='Connecting to '+id+'…';
  }catch(e){notify(e.message)}
};
$('enableTiltBtn').onclick=async()=>{
  try{
    if(typeof DeviceOrientationEvent==='undefined')throw Error('This device has no orientation sensor.');
    if(typeof DeviceOrientationEvent.requestPermission==='function'){
      const result=await DeviceOrientationEvent.requestPermission();
      if(result!=='granted')throw Error('Motion access was declined.');
    }
    tiltEnabled=!tiltEnabled;
    tiltNeutral=null;
    $('enableTiltBtn').textContent=tiltEnabled?'Disable tilt':'Enable tilt';
    $('tiltStatus').textContent=tiltEnabled?'Tilt your phone to control the maze.':'Tilt control is off.';
    if(!tiltEnabled&&dataChannel?.readyState==='open')
      dataChannel.send(JSON.stringify({kind:'tilt',x:0,y:0}));
  }catch(err){notify(err.message)}
};
$('neutralTiltBtn').onclick=()=>{tiltNeutral=lastTilt;notify(tiltNeutral?'Neutral position calibrated.':'Enable tilt and hold the phone still first.')};
window.addEventListener('deviceorientation',e=>{
  if(!tiltEnabled||!Number.isFinite(e.beta)||!Number.isFinite(e.gamma))return;
  lastTilt={beta:e.beta,gamma:e.gamma};
  if(!tiltNeutral)tiltNeutral={...lastTilt};
  const clampTilt=x=>Math.max(-1,Math.min(1,x));
  const x=clampTilt((e.gamma-tiltNeutral.gamma)/22);
  const y=clampTilt(-(e.beta-tiltNeutral.beta)/22);
  $('tiltStatus').textContent='Steer: '+Math.round(x*100)+'% · Walk: '+Math.round(y*100)+'%';
  if(controllerMode&&dataChannel?.readyState==='open'&&performance.now()-lastTiltSent>65){
    dataChannel.send(JSON.stringify({kind:'tilt',x,y}));lastTiltSent=performance.now();
  }
});
let lastRender=0;
function tick(now){
  let dt=Math.min(.06,Math.max(0,(now-lastFrame)/1000));lastFrame=now;
  if((screen==='explore'||screen==='vr')&&!finished&&!$('riddleDialog').open){
    const keys=new Set([...activeControls,...remoteControls]);
    const pads=navigator.getGamepads?.()||[];
    for(const pad of pads){if(!pad)continue;
      if(Math.abs(pad.axes[0]||0)>.2)player.angle+=pad.axes[0]*1.85*dt;
      if(Math.abs(pad.axes[1]||0)>.2)move(-pad.axes[1]*2.15*dt*(now<boostUntil?1.65:1),0);
    }
    if(keys.has('left'))player.angle-=1.85*dt;
    if(keys.has('right'))player.angle+=1.85*dt;
    if(remoteTilt.x)player.angle+=remoteTilt.x*1.85*dt;
    if(remoteTilt.y)move(remoteTilt.y*2.15*dt*(now<boostUntil?1.65:1),0);
    const fwd=Number(keys.has('forward'))-Number(keys.has('back'));
    const speed=screen==='vr'&&vrAuto?Number($('walkSpeed').value)/4:1;
    if(fwd)move(fwd*2.15*dt*(now<boostUntil?1.65:1),0);
    else if(screen==='vr'&&vrAuto)move(.85*speed*dt,0);
    seconds+=dt;
  }
  $('timer').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(Math.floor(seconds%60)).padStart(2,'0');
  if(now-lastRender>32){
    const quality=$('renderQuality').value;
    if(screen==='explore')renderMaze($('view'),board,player,{showMap,quality});
    if(screen==='vr')renderMaze($('stereo'),board,player,{stereo:true,quality});
    lastRender=now;
  }
  requestAnimationFrame(tick);
}
persist();gridDraw();refreshLibrary();refreshObjects();selectTheme();
requestAnimationFrame(tick);
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
