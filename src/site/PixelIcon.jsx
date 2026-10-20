// Hand-drawn 16×16 pixel icons rendered as crisp SVG rects (one rect per horizontal run).
//   '#' accent pink (#DB5B90)   'd' deep pink shade   'w' paper (theme aware)   '.' empty
const ICONS = {
  document: [
    '..########......',
    '..#wwwwww##.....',
    '..#wwwwww#w#....',
    '..#wwwwww#ww#...',
    '..#wwwwww####...',
    '..#wwwwwwwww#...',
    '..#w#######w#...',
    '..#wwwwwwwww#...',
    '..#w#######w#...',
    '..#wwwwwwwww#...',
    '..#w#######w#...',
    '..#wwwwwwwww#...',
    '..#w#####www#...',
    '..#wwwwwwwww#...',
    '..###########d..',
    '...ddddddddddd..',
  ],
  linkedin: [
    '................',
    '..############..',
    '.##############.',
    '.##ww##########.',
    '.##ww##########.',
    '.##############.',
    '.##ww##wwwwww##.',
    '.##ww##ww##ww##.',
    '.##ww##ww##ww##.',
    '.##ww##ww##ww##.',
    '.##ww##ww##ww##.',
    '.##ww##ww##ww##.',
    '.##############.',
    '..############d.',
    '...dddddddddddd.',
    '................',
  ],
  email: [
    '................',
    '................',
    '................',
    '.##############.',
    '.##wwwwwwwwww##.',
    '.#w##wwwwww##w#.',
    '.#www##ww##www#.',
    '.#wwwww##wwwww#.',
    '.#wwwwwwwwwwww#.',
    '.#wwwwwwwwwwww#.',
    '.#wwwwwwwwwwww#.',
    '.#wwwwwwwwwwww#.',
    '.##############d',
    '..dddddddddddddd',
    '................',
    '................',
  ],
  phone: [
    '................',
    '.####...........',
    '#####d..........',
    '#####d..........',
    '.###d...........',
    '.###d...........',
    '..###...........',
    '..###d..........',
    '...###d.........',
    '....###d..####..',
    '.....####d####d.',
    '......#########d',
    '.......#######dd',
    '........#####dd.',
    '.........ddddd..',
    '................',
  ],
  folder: [
    '................',
    '................',
    '.#####..........',
    '#wwwww#########.',
    '#wwwwwwwwwwwww#.',
    '###############.',
    '#wwwwwwwwwwwww#.',
    '#wwwwwwwwwwwww#.',
    '#wwwwwwwwwwwww#.',
    '#wwwwwwwwwwwww#.',
    '#wwwwwwwwwwwww#.',
    '#wwwwwwwwwwwww#.',
    '#wwwwwwwwwwwww#.',
    '###############d',
    '.dddddddddddddd.',
    '................',
  ],
  butterfly: [
    '.....d....d.....',
    '......d..d......',
    '..##...dd...##..',
    '.####..dd..####.',
    '.#####.dd.#####.',
    '.######dd######.',
    '.#w####dd####w#.',
    '..#####dd#####..',
    '...####dd####...',
    '....##.dd.##....',
    '...###.dd.###...',
    '..####.dd.####..',
    '..###..dd..###..',
    '...#........#...',
    '................',
    '................',
  ],
  thought: [
    '................',
    '....######......',
    '...#wwwwww#.....',
    '..#wwwwwwww#....',
    '.#wwwwwwwwww#...',
    '.#wwwwwwwwww#...',
    '.#w#ww#ww#ww#...',
    '.#wwwwwwwwww#...',
    '..#wwwwwwww#....',
    '...#wwwwww#.....',
    '....######......',
    '..##............',
    '..##............',
    '#...............',
    '................',
    '................',
  ],
  // these are drawn flat; withShadow() below adds the shared 1px deep-pink drop shadow
  sun: [
    '......##........',
    '......##........',
    '.##........##...',
    '.##..####..##...',
    '....######......',
    '...########.....',
    '##.########.##..',
    '##.########.##..',
    '...########.....',
    '....######......',
    '.##..####..##...',
    '.##........##...',
    '......##........',
    '......##........',
    '................',
    '................',
  ],
  // crescent with pointed horns, a few craters and a little star
  moon: [
    '............#...',
    '.....#.....###..',
    '...##.......#...',
    '..###...........',
    '.####...........',
    '.####...........',
    '.####...........',
    '.#d###..........',
    '.#####..........',
    '.######.........',
    '.########.......',
    '.##d#######...#.',
    '..######d#####..',
    '...##########...',
    '.....######.....',
    '................',
  ],
}

// vinyl record, 4 frames: the glint steps a quarter turn each frame, so the spin stays on the
// pixel grid (rotating the SVG would blur it and swing the shadow around)
for (let k = 0; k < 4; k++) {
  let glint = [[3, 3], [4, 2], [2, 4]]
  for (let i = 0; i < k; i++) glint = glint.map(([x, y]) => [14 - y, x])
  ICONS[`record${k}`] = Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => {
      const d2 = (x - 7) ** 2 + (y - 7) ** 2
      if (x > 14 || y > 14 || d2 > 51) return '.'
      if (d2 === 0) return '#' // spindle
      if (d2 <= 5) return 'w' // label
      if (glint.some(([gx, gy]) => gx === x && gy === y)) return 'w'
      if (d2 >= 13 && d2 <= 18) return 'd' // groove
      return '#'
    }).join(''),
  )
}

/** The shared icon style: every filled pixel casts a 1px deep-pink shadow down and right. */
function withShadow(rows) {
  const g = rows.map((r) => r.split(''))
  rows.forEach((row, y) => {
    ;[...row].forEach((c, x) => {
      if ((c === '#' || c === 'w') && g[y + 1]?.[x + 1] === '.') g[y + 1][x + 1] = 'd'
    })
  })
  return g.map((r) => r.join(''))
}
for (const name of ['sun', 'moon', 'thought', 'record0', 'record1', 'record2', 'record3']) ICONS[name] = withShadow(ICONS[name])

const FILL = { '#': 'var(--accent)', d: 'var(--accent-deep)', w: 'var(--icon-paper)' }

function runs(rows) {
  const rects = []
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const c = row[x]
      if (c === '.') { x++; continue }
      let w = 1
      while (row[x + w] === c) w++
      rects.push({ x, y, w, c })
      x += w
    }
  })
  return rects
}

const CACHE = {}


export default function PixelIcon({ name, size = 32, className, title }) {
  const rects = (CACHE[name] ??= runs(ICONS[name]))
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={FILL[r.c]} />
      ))}
    </svg>
  )
}
