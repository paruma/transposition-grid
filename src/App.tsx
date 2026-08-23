import { useRef, useState } from 'react';

type Cell = { row: number; column: number };
type Grid = string[][];

const createGrid = (rows: number, columns: number): Grid =>
  Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => String(row * columns + column + 1)),
  );

const isAdjacent = (first: Cell, second: Cell) =>
  Math.abs(first.row - second.row) + Math.abs(first.column - second.column) === 1;

const initialGrid = createGrid(3, 4);

export default function App() {
  const [rowInput, setRowInput] = useState('3');
  const [columnInput, setColumnInput] = useState('4');
  const [grid, setGrid] = useState<Grid>(initialGrid);
  const gridRef = useRef<Grid>(initialGrid);
  const activeCellRef = useRef<Cell | null>(null);
  const [dragging, setDragging] = useState(false);

  const replaceGrid = (nextGrid: Grid) => {
    gridRef.current = nextGrid;
    setGrid(nextGrid);
  };

  const resetGrid = () => {
    const rows = Number(rowInput);
    const columns = Number(columnInput);
    if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 1 || columns < 1) return;
    replaceGrid(createGrid(rows, columns));
  };

  const cellFromPoint = (clientX: number, clientY: number): Cell | null => {
    const element = document.elementFromPoint(clientX, clientY);
    const cell = element?.closest<HTMLElement>('[data-grid-cell]');
    if (!cell) return null;
    const row = Number(cell.dataset.row);
    const column = Number(cell.dataset.column);
    return Number.isInteger(row) && Number.isInteger(column) ? { row, column } : null;
  };

  const finishDrag = () => {
    activeCellRef.current = null;
    setDragging(false);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const cell = cellFromPoint(event.clientX, event.clientY);
    if (!cell || gridRef.current[cell.row][cell.column] === '') return;
    activeCellRef.current = cell;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const activeCell = activeCellRef.current;
    const destination = cellFromPoint(event.clientX, event.clientY);
    if (!activeCell || !destination || !isAdjacent(activeCell, destination)) return;

    const currentGrid = gridRef.current;
    if (currentGrid[destination.row][destination.column] === '') return;

    const nextGrid = currentGrid.map((row) => [...row]);
    [nextGrid[activeCell.row][activeCell.column], nextGrid[destination.row][destination.column]] = [
      nextGrid[destination.row][destination.column],
      nextGrid[activeCell.row][activeCell.column],
    ];
    replaceGrid(nextGrid);
    activeCellRef.current = destination;
  };

  const updateCell = (row: number, column: number, value: string) => {
    const nextGrid = gridRef.current.map((currentRow) => [...currentRow]);
    nextGrid[row][column] = value;
    replaceGrid(nextGrid);
  };

  return (
    <main className="app-shell">
      <header>
        <p className="eyebrow">S<sub>N</sub> の隣接互換</p>
        <h1>隣接互換グリッド</h1>
        <p className="description">
          番号のあるセルを掴み、上下左右の番号セルへ動かすと、通過するたびに交換します。空欄は壁です。
        </p>
      </header>

      <section className="controls" aria-label="グリッドのサイズ">
        <label>
          行
          <input type="number" min="1" value={rowInput} onChange={(event) => setRowInput(event.target.value)} />
        </label>
        <label>
          列
          <input type="number" min="1" value={columnInput} onChange={(event) => setColumnInput(event.target.value)} />
        </label>
        <button type="button" onClick={resetGrid}>サイズを設定</button>
      </section>

      <section
        className={`grid-board${dragging ? ' is-dragging' : ''}`}
        aria-label="互換を操作するグリッド"
        style={{ gridTemplateColumns: `repeat(${grid[0].length}, minmax(3.5rem, 1fr))` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        {grid.map((row, rowIndex) =>
          row.map((cell, columnIndex) => (
            <div
              className={`grid-cell${cell === '' ? ' is-wall' : ''}`}
              data-grid-cell
              data-row={rowIndex}
              data-column={columnIndex}
              key={`${rowIndex}-${columnIndex}`}
            >
              <input
                aria-label={`${rowIndex + 1} 行 ${columnIndex + 1} 列`}
                maxLength={12}
                onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
                value={cell}
              />
            </div>
          )),
        )}
      </section>

      <p className="hint">セルをクリックして入力・削除できます。空欄にしたセルは交換できません。</p>
    </main>
  );
}
