import { Point, DrawingStroke, User } from './types.js';

export class CanvasManager {
  private drawingCanvas: HTMLCanvasElement;
  private cursorCanvas: HTMLCanvasElement;
  private drawingCtx: CanvasRenderingContext2D;
  private cursorCtx: CanvasRenderingContext2D;
  private isDrawing = false;
  private currentStroke: DrawingStroke | null = null;
  private strokes: Map<string, DrawingStroke> = new Map();
  private userCursors: Map<string, { user: User; lastUpdate: number }> = new Map();
  
  // Drawing state
  private currentTool: 'brush' | 'eraser' = 'brush';
  private currentColor: string = '#000000';
  private currentLineWidth: number = 5;
  private currentUserId: string = '';

  // Undo/Redo stacks
  private undoStack: string[] = [];
  private redoStack: DrawingStroke[] = [];

  // Callbacks
  private onStrokeStart?: (stroke: DrawingStroke) => void;
  private onStrokeMove?: (strokeId: string, point: Point) => void;
  private onStrokeEnd?: (strokeId: string) => void;
  private onUndo?: () => void;
  private onRedo?: () => void;

  constructor(drawingCanvas: HTMLCanvasElement, cursorCanvas: HTMLCanvasElement) {
    this.drawingCanvas = drawingCanvas;
    this.cursorCanvas = cursorCanvas;
    
    const drawingCtx = drawingCanvas.getContext('2d');
    const cursorCtx = cursorCanvas.getContext('2d');
    
    if (!drawingCtx || !cursorCtx) {
      throw new Error('Could not get canvas context');
    }
    
    this.drawingCtx = drawingCtx;
    this.cursorCtx = cursorCtx;
    
    this.setupCanvas();
    this.setupEventListeners();
  }

  setUserId(userId: string): void {
    this.currentUserId = userId;
  }

  setCallbacks(callbacks: {
    onStrokeStart?: (stroke: DrawingStroke) => void;
    onStrokeMove?: (strokeId: string, point: Point) => void;
    onStrokeEnd?: (strokeId: string) => void;
    onUndo?: () => void;
    onRedo?: () => void;
  }): void {
    this.onStrokeStart = callbacks.onStrokeStart;
    this.onStrokeMove = callbacks.onStrokeMove;
    this.onStrokeEnd = callbacks.onStrokeEnd;
    this.onUndo = callbacks.onUndo;
    this.onRedo = callbacks.onRedo;
  }

  private setupCanvas(): void {
    const resize = () => {
      const container = this.drawingCanvas.parentElement;
      if (container) {
        const rect = container.getBoundingClientRect();
        this.drawingCanvas.width = rect.width;
        this.drawingCanvas.height = rect.height;
        this.cursorCanvas.width = rect.width;
        this.cursorCanvas.height = rect.height;
      }
    };

    resize();
    window.addEventListener('resize', resize);

    // Set canvas styles
    this.drawingCtx.lineCap = 'round';
    this.drawingCtx.lineJoin = 'round';
    this.cursorCtx.lineCap = 'round';
    this.cursorCtx.lineJoin = 'round';
  }

  private setupEventListeners(): void {
    // Mouse events
    this.drawingCanvas.addEventListener('mousedown', this.handleStart.bind(this));
    this.drawingCanvas.addEventListener('mousemove', this.handleMove.bind(this));
    this.drawingCanvas.addEventListener('mouseup', this.handleEnd.bind(this));
    this.drawingCanvas.addEventListener('mouseleave', this.handleEnd.bind(this));

    // Touch events for mobile
    this.drawingCanvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
    this.drawingCanvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
    this.drawingCanvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
    this.drawingCanvas.addEventListener('touchcancel', this.handleTouchEnd.bind(this));
  }

  private getPointFromEvent(e: MouseEvent | TouchEvent): Point | null {
    const rect = this.drawingCanvas.getBoundingClientRect();
    let clientX: number, clientY: number;

    if (e instanceof MouseEvent) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
      e.preventDefault(); // Prevent scrolling
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  private handleStart(e: MouseEvent | TouchEvent): void {
    const point = this.getPointFromEvent(e);
    if (!point) return;

    this.isDrawing = true;
    const strokeId = `stroke-${Date.now()}-${Math.random()}`;
    
    this.currentStroke = {
      id: strokeId,
      userId: this.currentUserId,
      tool: this.currentTool,
      color: this.currentColor,
      lineWidth: this.currentLineWidth,
      points: [point],
      timestamp: Date.now()
    };

    this.strokes.set(strokeId, this.currentStroke);
    this.drawPoint(point, this.currentTool, this.currentColor, this.currentLineWidth);

    if (this.onStrokeStart && this.currentStroke) {
      this.onStrokeStart(this.currentStroke);
    }
  }

  private handleMove(e: MouseEvent | TouchEvent): void {
    const point = this.getPointFromEvent(e);
    if (!point) return;

    if (this.isDrawing && this.currentStroke) {
      this.currentStroke.points.push(point);
      this.drawPoint(point, this.currentTool, this.currentColor, this.currentLineWidth);

      if (this.onStrokeMove) {
        this.onStrokeMove(this.currentStroke.id, point);
      }
    }
  }

  private handleEnd(e: MouseEvent | TouchEvent): void {
    if (this.isDrawing && this.currentStroke) {
      this.isDrawing = false;
      
      if (this.onStrokeEnd) {
        this.onStrokeEnd(this.currentStroke.id);
      }

      // Add to undo stack
      this.undoStack.push(this.currentStroke.id);
      this.redoStack = []; // Clear redo stack

      this.currentStroke = null;
    }
  }

  private handleTouchStart(e: TouchEvent): void {
    this.handleStart(e);
  }

  private handleTouchMove(e: TouchEvent): void {
    this.handleMove(e);
  }

  private handleTouchEnd(e: TouchEvent): void {
    this.handleEnd(e);
  }

  private drawPoint(point: Point, tool: 'brush' | 'eraser', color: string, lineWidth: number): void {
    const ctx = this.drawingCtx;
    const stroke = this.currentStroke;
    
    if (!stroke || stroke.points.length < 2) {
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(point.x, point.y);
    } else {
      const prevPoint = stroke.points[stroke.points.length - 2];
      ctx.beginPath();
      ctx.moveTo(prevPoint.x, prevPoint.y);
      ctx.lineTo(point.x, point.y);
    }

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
    }

    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  // External drawing methods (for remote strokes)
  drawRemoteStrokeStart(stroke: DrawingStroke): void {
    if (stroke.userId === this.currentUserId) return; // Don't redraw own strokes
    
    this.strokes.set(stroke.id, stroke);
    if (stroke.points.length > 0) {
      const point = stroke.points[0];
      this.drawRemotePoint(point, stroke.tool, stroke.color, stroke.lineWidth, stroke.id);
    }
  }

  drawRemoteStrokeMove(strokeId: string, point: Point): void {
    const stroke = this.strokes.get(strokeId);
    if (!stroke || stroke.userId === this.currentUserId) return;

    stroke.points.push(point);
    this.drawRemotePoint(point, stroke.tool, stroke.color, stroke.lineWidth, strokeId);
  }

  drawRemoteStrokeEnd(stroke: DrawingStroke): void {
    // Stroke is already being drawn, just mark as complete
    this.strokes.set(stroke.id, stroke);
  }

  private drawRemotePoint(point: Point, tool: 'brush' | 'eraser', color: string, lineWidth: number, strokeId: string): void {
    const stroke = this.strokes.get(strokeId);
    if (!stroke || stroke.points.length < 2) return;

    const ctx = this.drawingCtx;
    const prevPoint = stroke.points[stroke.points.length - 2];
    
    ctx.beginPath();
    ctx.moveTo(prevPoint.x, prevPoint.y);
    ctx.lineTo(point.x, point.y);

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
    }

    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  // Undo/Redo
  undo(strokeId: string): void {
    const stroke = this.strokes.get(strokeId);
    if (!stroke) return;

    // Remove stroke from map
    this.strokes.delete(strokeId);
    
    // Remove from undo stack and add to redo
    const index = this.undoStack.indexOf(strokeId);
    if (index !== -1) {
      this.undoStack.splice(index, 1);
      this.redoStack.push(stroke);
    }

    // Redraw canvas without the removed stroke
    this.redrawCanvas();
  }

  redo(stroke: DrawingStroke): void {
    // Restore the stroke
    this.strokes.set(stroke.id, stroke);
    
    // Remove from redo stack and add back to undo stack
    const redoIndex = this.redoStack.findIndex(s => s.id === stroke.id);
    if (redoIndex !== -1) {
      this.redoStack.splice(redoIndex, 1);
      this.undoStack.push(stroke.id);
    }

    // Redraw the stroke
    this.redrawStroke(stroke);
  }

  private redrawCanvas(): void {
    // Clear canvas
    this.drawingCtx.clearRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);
    
    // Redraw all strokes that are still in the strokes map
    this.strokes.forEach((stroke) => {
      this.redrawStroke(stroke);
    });
  }

  private redrawStroke(stroke: DrawingStroke): void {
    if (stroke.points.length === 0) return;

    const ctx = this.drawingCtx;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }

    if (stroke.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
    }

    ctx.lineWidth = stroke.lineWidth;
    ctx.stroke();
  }

  // Sync state
  syncState(strokes: DrawingStroke[]): void {
    // Clear and redraw everything
    this.strokes.clear();
    this.drawingCtx.clearRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);
    
    strokes.forEach(stroke => {
      this.strokes.set(stroke.id, stroke);
      this.redrawStroke(stroke);
    });

    // Rebuild undo stack
    this.undoStack = strokes.map(s => s.id);
    this.redoStack = [];
  }

  // Clear canvas
  clear(): void {
    this.drawingCtx.clearRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);
    this.strokes.clear();
    this.undoStack = [];
    this.redoStack = [];
  }

  // Tool setters
  setTool(tool: 'brush' | 'eraser'): void {
    this.currentTool = tool;
  }

  setColor(color: string): void {
    this.currentColor = color;
  }

  setLineWidth(width: number): void {
    this.currentLineWidth = width;
  }

  // Cursor management
  updateUserCursor(userId: string, user: User, point: Point): void {
    this.userCursors.set(userId, { user, lastUpdate: Date.now() });
    this.drawCursors();
  }

  removeUserCursor(userId: string): void {
    this.userCursors.delete(userId);
    this.drawCursors();
  }

  private drawCursors(): void {
    // Clear cursor canvas
    this.cursorCtx.clearRect(0, 0, this.cursorCanvas.width, this.cursorCanvas.height);
    
    // Draw all user cursors
    const now = Date.now();
    this.userCursors.forEach(({ user, lastUpdate }) => {
      // Remove stale cursors (older than 2 seconds)
      if (now - lastUpdate > 2000) {
        this.userCursors.delete(user.id);
        return;
      }

      if (user.cursorPosition && user.id !== this.currentUserId) {
        this.cursorCtx.fillStyle = user.color;
        this.cursorCtx.beginPath();
        this.cursorCtx.arc(user.cursorPosition.x, user.cursorPosition.y, 5, 0, Math.PI * 2);
        this.cursorCtx.fill();
        
        // Draw user name
        this.cursorCtx.fillStyle = user.color;
        this.cursorCtx.font = '12px Arial';
        this.cursorCtx.fillText(user.name, user.cursorPosition.x + 8, user.cursorPosition.y - 8);
      }
    });
  }
}

