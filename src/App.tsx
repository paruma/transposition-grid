import { useEffect, useRef, useState } from 'react';

type Cell = { row: number; column: number };
type PointerPosition = { x: number; y: number };
type Grid = string[][];
type HistoryEntry = { grid: Grid; rowInput: string; columnInput: string };
type SwapAnimation = {
  id: number;
  label: string;
  from: DOMRect;
  to: DOMRect;
  hiddenCellKeys: string[];
};

const createGrid = (rows: number, columns: number): Grid =>
  Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => String(row * columns + column + 1)),
  );

const isAdjacent = (first: Cell, second: Cell) =>
  Math.abs(first.row - second.row) + Math.abs(first.column - second.column) === 1;

const initialGrid = createGrid(3, 4);
const cloneGrid = (grid: Grid): Grid => grid.map((row) => [...row]);

export default function App() {
  const [rowInput, setRowInput] = useState('3');
  const [columnInput, setColumnInput] = useState('4');
  const [grid, setGrid] = useState<Grid>(initialGrid);
  const gridRef = useRef<Grid>(initialGrid);
  const rowInputRef = useRef(rowInput);
  const columnInputRef = useRef(columnInput);
  const historyRef = useRef<HistoryEntry[]>([
    { grid: cloneGrid(initialGrid), rowInput: '3', columnInput: '4' },
  ]);
  const historyIndexRef = useRef(0);
  const activeCellRef = useRef<Cell | null>(null);
  const dragStartRef = useRef<PointerPosition | null>(null);
  const isDraggingRef = useRef(false);
  const pressedInputRef = useRef<HTMLInputElement | null>(null);
  const didSwapRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [heldLabel, setHeldLabel] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<PointerPosition | null>(null);
  const [swapAnimations, setSwapAnimations] = useState<SwapAnimation[]>([]);
  const animationIdRef = useRef(0);

  rowInputRef.current = rowInput;
  columnInputRef.current = columnInput;

  const replaceGrid = (nextGrid: Grid) => {
    gridRef.current = nextGrid;
    setGrid(nextGrid);
  };

  const recordHistory = (
    nextGrid: Grid,
    nextRowInput = rowInputRef.current,
    nextColumnInput = columnInputRef.current,
  ) => {
    const nextEntry = {
      grid: cloneGrid(nextGrid),
      rowInput: nextRowInput,
      columnInput: nextColumnInput,
    };
    const currentEntry = historyRef.current[historyIndexRef.current];
    if (JSON.stringify(currentEntry) === JSON.stringify(nextEntry)) return;

    historyRef.current = [...historyRef.current.slice(0, historyIndexRef.current + 1), nextEntry].slice(-100);
    historyIndexRef.current = historyRef.current.length - 1;
  };

  const restoreHistory = (entry: HistoryEntry) => {
    replaceGrid(cloneGrid(entry.grid));
    setRowInput(entry.rowInput);
    setColumnInput(entry.columnInput);
    setSwapAnimations([]);
  };

  const undo = () => {
    if (historyIndexRef.current === 0) return;
    historyIndexRef.current -= 1;
    restoreHistory(historyRef.current[historyIndexRef.current]);
  };

  const redo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    restoreHistory(historyRef.current[historyIndexRef.current]);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if (!(event.ctrlKey || event.metaKey)) return;

      if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey)) {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const resetGrid = () => {
    const rows = Number(rowInput);
    const columns = Number(columnInput);
    if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 1 || columns < 1) return;
    const nextGrid = createGrid(rows, columns);
    replaceGrid(nextGrid);
    recordHistory(nextGrid, rowInput, columnInput);
    setSwapAnimations([]);
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
    const wasDragging = isDraggingRef.current;
    if (didSwapRef.current && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (didSwapRef.current) recordHistory(gridRef.current);
    activeCellRef.current = null;
    dragStartRef.current = null;
    isDraggingRef.current = false;
    didSwapRef.current = false;
    setDragging(false);
    setHeldLabel(null);
    setDragPosition(null);
    if (!wasDragging) pressedInputRef.current?.focus();
    pressedInputRef.current = null;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const cell = cellFromPoint(event.clientX, event.clientY);
    if (!cell || gridRef.current[cell.row][cell.column] === '') return;
    event.preventDefault();
    activeCellRef.current = cell;
    pressedInputRef.current = event.target instanceof HTMLInputElement ? event.target : null;
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    isDraggingRef.current = false;
    didSwapRef.current = false;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const activeCell = activeCellRef.current;
    if (!activeCell) return;

    if (!isDraggingRef.current) {
      const dragStart = dragStartRef.current;
      if (!dragStart || Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y) < 4) return;
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      isDraggingRef.current = true;
      setDragging(true);
      setHeldLabel(gridRef.current[activeCell.row][activeCell.column]);
    }

    setDragPosition({ x: event.clientX, y: event.clientY });
    const destination = cellFromPoint(event.clientX, event.clientY);
    if (!activeCell || !destination || !isAdjacent(activeCell, destination)) return;

    const currentGrid = gridRef.current;
    if (currentGrid[destination.row][destination.column] === '') return;

    const sourceElement = document.querySelector<HTMLElement>(
      `[data-row="${activeCell.row}"][data-column="${activeCell.column}"]`,
    );
    const destinationElement = document.querySelector<HTMLElement>(
      `[data-row="${destination.row}"][data-column="${destination.column}"]`,
    );
    if (!sourceElement || !destinationElement) return;

    const sourceRect = sourceElement.getBoundingClientRect();
    const destinationRect = destinationElement.getBoundingClientRect();
    const destinationLabel = currentGrid[destination.row][destination.column];
    const nextAnimationId = animationIdRef.current + 1;
    animationIdRef.current = nextAnimationId;
    setSwapAnimations((current) => [
      ...current,
      {
        id: nextAnimationId,
        label: destinationLabel,
        from: destinationRect,
        to: sourceRect,
        hiddenCellKeys: [
          `${activeCell.row}-${activeCell.column}`,
          `${destination.row}-${destination.column}`,
        ],
      },
    ]);

    const nextGrid = currentGrid.map((row) => [...row]);
    [nextGrid[activeCell.row][activeCell.column], nextGrid[destination.row][destination.column]] = [
      nextGrid[destination.row][destination.column],
      nextGrid[activeCell.row][activeCell.column],
    ];
    replaceGrid(nextGrid);
    activeCellRef.current = destination;
    didSwapRef.current = true;
  };

  const updateCell = (row: number, column: number, value: string) => {
    const nextGrid = gridRef.current.map((currentRow) => [...currentRow]);
    nextGrid[row][column] = value;
    replaceGrid(nextGrid);
    recordHistory(nextGrid);
  };

  const animatingCellKeys = new Set(swapAnimations.flatMap((animation) => animation.hiddenCellKeys));

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
        style={{ gridTemplateColumns: `repeat(${grid[0].length}, 4.25rem)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        {grid.map((row, rowIndex) =>
          row.map((cell, columnIndex) => (
            <div
              className={`grid-cell${cell === '' ? ' is-wall' : ''}${
                animatingCellKeys.has(`${rowIndex}-${columnIndex}`) ? ' is-animating' : ''
              }`}
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

      {heldLabel !== null && dragPosition !== null && (
        <div
          className="held-token"
          aria-hidden="true"
          style={{ left: dragPosition.x, top: dragPosition.y }}
        >
          {heldLabel}
        </div>
      )}

      {swapAnimations.map((animation) => (
        <div
          className="swap-token"
          aria-hidden="true"
          key={animation.id}
          onAnimationEnd={() =>
            setSwapAnimations((current) => current.filter((item) => item.id !== animation.id))
          }
          style={
            {
              left: animation.from.left,
              top: animation.from.top,
              width: animation.from.width,
              height: animation.from.height,
              '--translate-x': `${animation.to.left - animation.from.left}px`,
              '--translate-y': `${animation.to.top - animation.from.top}px`,
            } as React.CSSProperties
          }
        >
          {animation.label}
        </div>
      ))}

      <p className="hint">
        セルをクリックして入力・削除できます。空欄にしたセルは交換できません。Ctrl+Z で戻し、Ctrl+Y でやり直せます。
      </p>
    </main>
  );
}
