export class CanvasManager {
    constructor(drawingCanvas, cursorCanvas) {
        this.isDrawing = false;
        this.currentStroke = null;
        this.strokes = new Map();
        this.userCursors = new Map();
        // Drawing state
        this.currentTool = 'brush';
        this.currentColor = '#000000';
        this.currentLineWidth = 5;
        this.currentUserId = '';
        // Undo/Redo stacks
        this.undoStack = [];
        this.redoStack = [];
        this.pendingStrokeId = null; // Track stroke ID waiting for server response
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
    setUserId(userId) {
        this.currentUserId = userId;
    }
    setCallbacks(callbacks) {
        this.onStrokeStart = callbacks.onStrokeStart;
        this.onStrokeMove = callbacks.onStrokeMove;
        this.onStrokeEnd = callbacks.onStrokeEnd;
        this.onUndo = callbacks.onUndo;
        this.onRedo = callbacks.onRedo;
    }
    setupCanvas() {
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
    setupEventListeners() {
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
    getPointFromEvent(e) {
        const rect = this.drawingCanvas.getBoundingClientRect();
        let clientX, clientY;
        if (e instanceof MouseEvent) {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        else {
            if (e.touches.length === 0)
                return null;
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
            e.preventDefault(); // Prevent scrolling
        }
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }
    handleStart(e) {
        const point = this.getPointFromEvent(e);
        if (!point)
            return;
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
    handleMove(e) {
        const point = this.getPointFromEvent(e);
        if (!point)
            return;
        if (this.isDrawing && this.currentStroke) {
            this.currentStroke.points.push(point);
            this.drawPoint(point, this.currentTool, this.currentColor, this.currentLineWidth);
            if (this.onStrokeMove) {
                this.onStrokeMove(this.currentStroke.id, point);
            }
        }
    }
    handleEnd(e) {
        if (this.isDrawing && this.currentStroke) {
            this.isDrawing = false;
            if (this.onStrokeEnd) {
                this.onStrokeEnd(this.currentStroke.id);
            }
            // Add to undo stack (will be updated when server responds with correct ID)
            this.undoStack.push(this.currentStroke.id);
            this.pendingStrokeId = this.currentStroke.id; // Track for ID update
            this.redoStack = []; // Clear redo stack
            this.currentStroke = null;
        }
    }
    handleTouchStart(e) {
        this.handleStart(e);
    }
    handleTouchMove(e) {
        this.handleMove(e);
    }
    handleTouchEnd(e) {
        this.handleEnd(e);
    }
    drawPoint(point, tool, color, lineWidth) {
        const ctx = this.drawingCtx;
        const stroke = this.currentStroke;
        if (!stroke || stroke.points.length < 2) {
            ctx.beginPath();
            ctx.moveTo(point.x, point.y);
            ctx.lineTo(point.x, point.y);
        }
        else {
            const prevPoint = stroke.points[stroke.points.length - 2];
            ctx.beginPath();
            ctx.moveTo(prevPoint.x, prevPoint.y);
            ctx.lineTo(point.x, point.y);
        }
        if (tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)';
        }
        else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = color;
        }
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
    // External drawing methods (for remote strokes)
    drawRemoteStrokeStart(stroke) {
        // If this is our own stroke, update the local stroke ID to match server's ID
        if (stroke.userId === this.currentUserId) {
            let localStroke = null;
            let oldId = null;
            if (this.currentStroke) {
                // Stroke is still being drawn
                localStroke = this.currentStroke;
                oldId = localStroke.id;
                localStroke.id = stroke.id;
                this.pendingStrokeId = stroke.id; // Track for undo stack update
            }
            else if (this.pendingStrokeId) {
                // Try to find stroke by pending ID first (most recent)
                const pendingStroke = this.strokes.get(this.pendingStrokeId);
                if (pendingStroke && pendingStroke.userId === this.currentUserId) {
                    localStroke = pendingStroke;
                    oldId = this.pendingStrokeId;
                    localStroke.id = stroke.id;
                }
            }
            // If not found, try to find by matching characteristics
            if (!localStroke) {
                for (const [id, s] of this.strokes.entries()) {
                    if (s.userId === this.currentUserId &&
                        Math.abs(s.timestamp - stroke.timestamp) < 2000 &&
                        s.points.length > 0 &&
                        stroke.points.length > 0 &&
                        s.points[0].x === stroke.points[0].x &&
                        s.points[0].y === stroke.points[0].y) {
                        localStroke = s;
                        oldId = id;
                        localStroke.id = stroke.id;
                        break;
                    }
                }
            }
            if (localStroke && oldId) {
                // Update strokes map
                this.strokes.delete(oldId);
                this.strokes.set(stroke.id, localStroke);
                // Update undo stack if the old ID is there
                const undoIndex = this.undoStack.indexOf(oldId);
                if (undoIndex !== -1) {
                    this.undoStack[undoIndex] = stroke.id;
                }
                this.pendingStrokeId = stroke.id;
            }
            return; // Don't redraw own strokes
        }
        this.strokes.set(stroke.id, stroke);
        if (stroke.points.length > 0) {
            const point = stroke.points[0];
            this.drawRemotePoint(point, stroke.tool, stroke.color, stroke.lineWidth, stroke.id);
        }
    }
    drawRemoteStrokeMove(strokeId, point) {
        const stroke = this.strokes.get(strokeId);
        if (!stroke || stroke.userId === this.currentUserId)
            return;
        stroke.points.push(point);
        this.drawRemotePoint(point, stroke.tool, stroke.color, stroke.lineWidth, strokeId);
    }
    drawRemoteStrokeEnd(stroke) {
        // Stroke is already being drawn, just mark as complete
        this.strokes.set(stroke.id, stroke);
    }
    drawRemotePoint(point, tool, color, lineWidth, strokeId) {
        const stroke = this.strokes.get(strokeId);
        if (!stroke || stroke.points.length < 2)
            return;
        const ctx = this.drawingCtx;
        const prevPoint = stroke.points[stroke.points.length - 2];
        ctx.beginPath();
        ctx.moveTo(prevPoint.x, prevPoint.y);
        ctx.lineTo(point.x, point.y);
        if (tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)';
        }
        else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = color;
        }
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
    // Undo/Redo
    undo(strokeId) {
        const stroke = this.strokes.get(strokeId);
        if (stroke) {
            // Remove stroke from map (regardless of who owns it - collaborative undo)
            this.strokes.delete(strokeId);
            // Only update undo/redo stacks if it's the current user's stroke
            if (stroke.userId === this.currentUserId) {
                // Remove from undo stack and add to redo
                const index = this.undoStack.indexOf(strokeId);
                if (index !== -1) {
                    this.undoStack.splice(index, 1);
                    this.redoStack.push(stroke);
                }
                else {
                    // Stroke not in undo stack but server says to undo it
                    // Add to redo stack anyway (might be from server sync)
                    this.redoStack.push(stroke);
                }
            }
        }
        else {
            // Stroke not found - might have been already undone or doesn't exist
            // Remove from undo stack if it's there (only if it's our stroke)
            const index = this.undoStack.indexOf(strokeId);
            if (index !== -1) {
                this.undoStack.splice(index, 1);
            }
        }
        // Always redraw canvas to ensure visual consistency (even if stroke wasn't found)
        this.redrawCanvas();
    }
    redo(stroke) {
        // Check if stroke already exists (might have been redone already)
        if (this.strokes.has(stroke.id)) {
            // Stroke already exists, just ensure it's in undo stack (if it's our stroke)
            if (stroke.userId === this.currentUserId && !this.undoStack.includes(stroke.id)) {
                this.undoStack.push(stroke.id);
            }
            return;
        }
        // Restore the stroke (regardless of who owns it - collaborative redo)
        this.strokes.set(stroke.id, stroke);
        // Only update undo/redo stacks if it's the current user's stroke
        if (stroke.userId === this.currentUserId) {
            // Remove from redo stack and add back to undo stack
            const redoIndex = this.redoStack.findIndex(s => s.id === stroke.id);
            if (redoIndex !== -1) {
                this.redoStack.splice(redoIndex, 1);
                this.undoStack.push(stroke.id);
            }
            else {
                // If not in redo stack, add it anyway (might be from server sync)
                this.undoStack.push(stroke.id);
            }
        }
        // Redraw the stroke
        this.redrawStroke(stroke);
    }
    redrawCanvas() {
        // Clear canvas
        this.drawingCtx.clearRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);
        // Redraw all strokes that are still in the strokes map
        this.strokes.forEach((stroke) => {
            this.redrawStroke(stroke);
        });
    }
    redrawStroke(stroke) {
        if (stroke.points.length === 0)
            return;
        const ctx = this.drawingCtx;
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        if (stroke.tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)';
        }
        else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = stroke.color;
        }
        ctx.lineWidth = stroke.lineWidth;
        ctx.stroke();
    }
    // Sync state
    syncState(strokes) {
        // Clear and redraw everything
        this.strokes.clear();
        this.drawingCtx.clearRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);
        strokes.forEach(stroke => {
            this.strokes.set(stroke.id, stroke);
            this.redrawStroke(stroke);
        });
        // Rebuild undo stack - only include strokes by the current user
        // Keep existing redo stack items that are still valid
        this.undoStack = strokes
            .filter(s => s.userId === this.currentUserId)
            .map(s => s.id);
        // Filter redo stack to only include strokes that are still valid (not in current strokes)
        this.redoStack = this.redoStack.filter(redoStroke => {
            // Keep if it's not in the current strokes and belongs to current user
            return !strokes.some(s => s.id === redoStroke.id) &&
                redoStroke.userId === this.currentUserId;
        });
        // Clear pending stroke ID after sync
        this.pendingStrokeId = null;
    }
    // Clear canvas
    clear() {
        this.drawingCtx.clearRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);
        this.strokes.clear();
        this.undoStack = [];
        this.redoStack = [];
        this.pendingStrokeId = null;
    }
    // Tool setters
    setTool(tool) {
        this.currentTool = tool;
    }
    setColor(color) {
        this.currentColor = color;
    }
    setLineWidth(width) {
        this.currentLineWidth = width;
    }
    // Cursor management
    updateUserCursor(userId, user, point) {
        this.userCursors.set(userId, { user, lastUpdate: Date.now() });
        this.drawCursors();
    }
    removeUserCursor(userId) {
        this.userCursors.delete(userId);
        this.drawCursors();
    }
    drawCursors() {
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
//# sourceMappingURL=canvas.js.map