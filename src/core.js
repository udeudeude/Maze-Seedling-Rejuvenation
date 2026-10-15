// Maze data model. No dependencies; also exercised by Node's built-in test runner.
export const DEFAULT_SIZE = 18;
export const CELL_TYPES = Object.freeze(['empty', 'wall', 'start', 'exit', 'trap', 'treasure', 'portal', 'riddle', 'boost']);
export const THEMES = Object.freeze(['castle', 'space', 'ruins', 'forest']);

export function createBoard(size = DEFAULT_SIZE) {
  if (!Number.isInteger(size) || size < 6 || size > 24) throw new Error('Grid size must be 6–24.');
  const cells = Array(size * size).fill('empty');
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (x === 0 || y === 0 || x === size - 1 || y === size - 1) cells[y * size + x] = 'wall';
  }
  cells[size + 1] = 'start';
  cells[(size - 2) * size + size - 2] = 'exit';
  return { version: 2, size, title: 'My Maze', theme: 'castle', cells, notes: {}, answers: {}, media: {}, collected: [] };
}

export function exampleBoard() {
  const board = createBoard();
  const n = board.size;
  // A deliberately solvable snake with a few alternate branches.
  for (let x = 4; x < n - 2; x += 4) {
    for (let y = 2; y < n - 2; y++) {
      if ((x / 4) % 2 ? y !== n - 4 : y !== 3) board.cells[y * n + x] = 'wall';
    }
  }
  board.cells[5 * n + 2] = 'treasure';
  board.cells[11 * n + 9] = 'trap';
  board.cells[4 * n + 13] = 'riddle';
  return board;
}

export function copyBoard(board) {
  return { ...board, cells: [...board.cells], notes: { ...board.notes }, answers: { ...(board.answers || {}) }, media: { ...(board.media || {}) }, collected: [...(board.collected || [])] };
}

export function normalizeBoard(input) {
  if (!input || typeof input !== 'object') throw new Error('Invalid maze file.');
  const size = input.size;
  if (!Number.isInteger(size) || size < 6 || size > 24) throw new Error('Unsupported grid size.');
  if (!Array.isArray(input.cells) || input.cells.length !== size * size ||
      !input.cells.every(c => CELL_TYPES.includes(c))) throw new Error('Invalid maze cells.');
  if (input.cells.filter(c => c === 'start').length !== 1 ||
      input.cells.filter(c => c === 'exit').length !== 1) throw new Error('A maze needs one start and one exit.');
  const notes = {};
  if (input.notes && typeof input.notes === 'object' && !Array.isArray(input.notes)) {
    for (const [key, value] of Object.entries(input.notes)) {
      const i = Number(key);
      if (Number.isInteger(i) && i >= 0 && i < size * size && typeof value === 'string')
        notes[i] = value.slice(0, 500);
    }
  }
  const answers = {};
  if (input.answers && typeof input.answers === 'object' && !Array.isArray(input.answers)) {
    for(const [key,value] of Object.entries(input.answers)){
      const i=Number(key);
      if(Number.isInteger(i)&&i>=0&&i<size*size&&typeof value==='string')
        answers[i]=value.slice(0,100);
    }
  }
  const media = {};
  let mediaBytes = 0;
  if (input.media && typeof input.media === 'object' && !Array.isArray(input.media)) {
    for (const [key, value] of Object.entries(input.media)) {
      const i = Number(key);
      if (!Number.isInteger(i) || i < 0 || i >= size * size ||
          !value || typeof value !== 'object' || Array.isArray(value)) continue;
      const safe = {};
      for (const field of ['image','audio']) {
        const data = value[field];
        const prefix = field === 'image' ? /^data:image\/(jpeg|png|webp);base64,/ :
          /^data:audio\/(mp4|mpeg|webm|ogg|x-m4a);base64,/;
        if (typeof data === 'string' && data.length < 550_000 && prefix.test(data) &&
            mediaBytes + data.length < 2_000_000) {
          safe[field] = data;mediaBytes += data.length;
        }
      }
      if (Object.keys(safe).length) media[i] = safe;
    }
  }
  const title = typeof input.title === 'string' ? input.title.slice(0, 80) : 'Imported Maze';
  const theme = THEMES.includes(input.theme) ? input.theme : 'castle';
  return { version: 2, size, title, theme, cells: [...input.cells], notes, answers, media, collected: [] };
}

export function paintCell(board, index, type) {
  if (!CELL_TYPES.includes(type)) throw new Error('Unknown tool.');
  if (!Number.isInteger(index) || index < 0 || index >= board.cells.length) return board;
  const next = copyBoard(board);
  const previous = next.cells[index];
  if ((previous === 'start' || previous === 'exit') && previous !== type) return board;
  if (type === 'start' || type === 'exit') {
    const old = next.cells.indexOf(type);
    if (old !== -1) next.cells[old] = 'empty';
  }
  next.cells[index] = type;
  return next;
}

export function passable(board, x, y, radius = 0) {
  // Axis-aligned circle approximation: reject if any of the bounding tile corners are walls.
  for (const dx of [-radius, radius]) for (const dy of [-radius, radius]) {
    const cx = Math.floor(x + dx), cy = Math.floor(y + dy);
    if (cx < 0 || cy < 0 || cx >= board.size || cy >= board.size ||
        board.cells[cy * board.size + cx] === 'wall') return false;
  }
  return true;
}

export function findPath(board) {
  const n = board.size, start = board.cells.indexOf('start'), exit = board.cells.indexOf('exit');
  const queue = [start], visited = new Set([start]), prev = new Map();
  for (let at = 0; at < queue.length; at++) {
    const i = queue[at];
    if (i === exit) {
      const route = [i];
      while (prev.has(route[route.length - 1])) route.push(prev.get(route[route.length - 1]));
      return route.reverse();
    }
    const x = i % n, y = Math.floor(i / n);
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx, ny = y + dy, j = ny * n + nx;
      if (nx < 0 || ny < 0 || nx >= n || ny >= n || visited.has(j) || board.cells[j] === 'wall') continue;
      visited.add(j); prev.set(j, i); queue.push(j);
    }
  }
  return null;
}

export function startPosition(board) {
  const i = board.cells.indexOf('start');
  return { x: i % board.size + 0.5, y: Math.floor(i / board.size) + 0.5, angle: 0, pitch: 0 };
}

export function cellAt(board, x, y) {
  const cx = Math.floor(x), cy = Math.floor(y);
  return cx < 0 || cy < 0 || cx >= board.size || cy >= board.size ?
    'wall' : board.cells[cy * board.size + cx];
}

// Bilinear sampling allows hand-selected photo corners, even when the board is skewed.
export function mapQuad(corners, u, v) {
  if (!Array.isArray(corners) || corners.length !== 4) throw new Error('Four corners required.');
  const [tl, tr, br, bl] = corners;
  return {
    x: (1-u)*(1-v)*tl.x + u*(1-v)*tr.x + u*v*br.x + (1-u)*v*bl.x,
    y: (1-u)*(1-v)*tl.y + u*(1-v)*tr.y + u*v*br.y + (1-u)*v*bl.y
  };
}

export function classifySamples(color, floor, wall, cutoff = 0.15) {
  const distance = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
  const dFloor = distance(color, floor), dWall = distance(color, wall);
  const certainty = (dFloor-dWall)/Math.max(1,dFloor+dWall);
  return { wall: certainty > cutoff, confidence: certainty };
}
