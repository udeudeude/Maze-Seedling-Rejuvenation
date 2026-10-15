import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SIZE, createBoard, exampleBoard, normalizeBoard, paintCell,
  findPath, startPosition, passable, mapQuad, classifySamples } from '../src/core.js';

test('Seedling model defaults to 18x18 and a traversable maze', () => {
  const b = createBoard();
  assert.equal(DEFAULT_SIZE, 18);
  assert.equal(b.cells.length, 324);
  assert.ok(findPath(b)?.length > 1);
  assert.equal(passable(b, 0.1, 0.1), false);
  assert.equal(passable(b, 1.5, 1.5, 0.15), true);
});
test('sample level remains solvable', () => assert.ok(findPath(exampleBoard())));
test('moves unique start/exit while preserving count', () => {
  const b = createBoard();
  const a = paintCell(b, b.size + 2, 'start');
  assert.equal(a.cells.filter(c => c === 'start').length, 1);
  assert.equal(b.cells[b.size + 1], 'start'); // original immutable
  assert.equal(startPosition(a).x, 2.5);
  assert.equal(paintCell(a, b.size + 2, 'wall'), a); // protect start
});
test('blocked maze is reported unsolvable', () => {
  let b = createBoard();
  b = paintCell(b, b.size + 2, 'wall');
  b = paintCell(b, 2 * b.size + 1, 'wall');
  assert.equal(findPath(b), null);
});
test('read old 12x12 JSON without destroying maze', () => {
  const old = createBoard(12);
  old.version = 1;
  const migrated = normalizeBoard(old);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.size, 12);
  assert.equal(migrated.cells.length, 144);
});
test('reject malformed / hostile data', () => {
  assert.throws(() => normalizeBoard({ size: 18, cells: ['wall'] }));
  assert.throws(() => normalizeBoard({ size: 18, cells: Array(324).fill('wall') }));
  let b = createBoard();
  b.notes[22] = '<script>alert(1)</script>';
  b.title = 'A'.repeat(200);
  const normalized = normalizeBoard(b);
  assert.equal(normalized.title.length, 80);
  assert.equal(normalized.notes[22], '<script>alert(1)</script>');
});
test('photo corner mapping remains within quadrilateral', () => {
  const p = [{ x: 10, y: 20 }, { x: 90, y: 10 }, { x: 100, y: 100 }, { x: 20, y: 90 }];
  assert.deepEqual(mapQuad(p, 0, 0), p[0]);
  assert.deepEqual(mapQuad(p, 1, 1), p[2]);
  const mid = mapQuad(p, 0.5, 0.5);
  assert.equal(mid.x, 55); assert.equal(mid.y, 55);
});
test('color classification uses wall and floor references', () => {
  const floor=[230,223,205], wall=[106,78,44];
  assert.equal(classifySamples([109,79,43],floor,wall).wall, true);
  assert.equal(classifySamples([229,220,205],floor,wall).wall, false);
});

test('encounter answers and safe media survive JSON export/import',()=>{
  const b=createBoard();
  b.cells[b.size+2]='riddle';
  b.answers[b.size+2]='The moon';
  b.media[b.size+2]={
    image:'data:image/jpeg;base64,AAAA',
    audio:'data:audio/mp4;base64,AAAA'
  };
  const imported=normalizeBoard(JSON.parse(JSON.stringify(b)));
  assert.equal(imported.answers[b.size+2],'The moon');
  assert.equal(imported.media[b.size+2].image,b.media[b.size+2].image);
  assert.equal(imported.media[b.size+2].audio,b.media[b.size+2].audio);
});
test('reject media with active URLs or SVG payloads',()=>{
  const b=createBoard();
  b.media[20]={image:'javascript:alert(1)',audio:'https://example.com/audio'};
  b.media[21]={image:'data:image/svg+xml;base64,AAAA'};
  const parsed=normalizeBoard(b);
  assert.equal(parsed.media[20],undefined);
  assert.equal(parsed.media[21],undefined);
});
