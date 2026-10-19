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
  jar: [
    '................',
    '....########....',
    '....#dddddd#....',
    '.....######.....',
    '....#wwwwww#....',
    '...#wwwwwwww#...',
    '..#wwwwwwwwww#..',
    '..#ww##w##www#..',
    '..#www#d#wwww#..',
    '..#ww##w##www#..',
    '..#wwwwwwwwww#..',
    '..#wwwwwwwwww#..',
    '...#wwwwwwww#...',
    '....########....',
    '.....dddddd.....',
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
  sun: [
    '.......##.......',
    '.......##.......',
    '..##........##..',
    '..##..####..##..',
    '....########....',
    '...##########...',
    '...##########...',
    '##.##########.##',
    '##.##########.##',
    '...##########...',
    '...##########...',
    '....########....',
    '..##..####..##..',
    '..##........##..',
    '.......##.......',
    '.......##.......',
  ],
}

// moon: a disc minus an offset disc, snapped to the pixel grid
ICONS.moon = Array.from({ length: 16 }, (_, y) =>
  Array.from({ length: 16 }, (_, x) => {
    const inA = (x - 7.5) ** 2 + (y - 7.5) ** 2 <= 6.6 ** 2
    const inB = (x - 11.2) ** 2 + (y - 5.2) ** 2 <= 5.4 ** 2
    return inA && !inB ? '#' : '.'
  }).join(''),
)

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
