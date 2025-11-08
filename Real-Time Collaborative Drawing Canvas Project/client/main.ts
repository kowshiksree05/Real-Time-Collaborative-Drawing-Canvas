import { CanvasManager } from './canvas.js';
import { WebSocketManager } from './websocket.js';
import { DrawingStroke, User, Point } from './types.js';

class App {
  private canvasManager: CanvasManager;
  private websocketManager: WebSocketManager;
  private users: Map<string, User> = new Map();
  private currentUserId: string = '';

  constructor() {
    const drawingCanvas = document.getElementById('drawingCanvas') as HTMLCanvasElement;
    const cursorCanvas = document.getElementById('cursorCanvas') as HTMLCanvasElement;

    if (!drawingCanvas || !cursorCanvas) {
      throw new Error('Canvas elements not found');
    }

    this.canvasManager = new CanvasManager(drawingCanvas, cursorCanvas);
    this.websocketManager = new WebSocketManager();

    this.setupUI();
    this.setupWebSocket();
    this.setupCanvasCallbacks();
  }

  private setupUI(): void {
    // Join modal
    const joinModal = document.getElementById('joinModal');
    const joinBtn = document.getElementById('joinBtn');
    const userNameInput = document.getElementById('userNameInput') as HTMLInputElement;
    const roomIdInput = document.getElementById('roomIdInput') as HTMLInputElement;

    if (joinBtn && userNameInput && roomIdInput && joinModal) {
      joinBtn.addEventListener('click', () => {
        const userName = userNameInput.value.trim() || undefined;
        const roomId = roomIdInput.value.trim() || 'default';
        
        console.log('Join button clicked:', { userName, roomId });
        
        // Update UI first
        const userNameDisplay = document.getElementById('userName');
        if (userNameDisplay) {
          userNameDisplay.textContent = userName || 'User';
        }
        
        const roomIdDisplay = document.getElementById('roomId');
        if (roomIdDisplay) {
          roomIdDisplay.textContent = `Room: ${roomId}`;
        }
        
        // Try to join room
        const joined = this.websocketManager.joinRoom(roomId, userName);
        console.log('Join room result:', joined);
        
        // Hide modal - connection will happen in background
        joinModal.classList.add('hidden');
      });

      // Enter key to join
      userNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          joinBtn.click();
        }
      });

      roomIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          joinBtn.click();
        }
      });
    }

    // Tool buttons
    const brushTool = document.getElementById('brushTool');
    const eraserTool = document.getElementById('eraserTool');

    brushTool?.addEventListener('click', () => {
      this.canvasManager.setTool('brush');
      brushTool.classList.add('active');
      eraserTool?.classList.remove('active');
    });

    eraserTool?.addEventListener('click', () => {
      this.canvasManager.setTool('eraser');
      eraserTool.classList.add('active');
      brushTool?.classList.remove('active');
    });

    // Color picker
    const colorPicker = document.getElementById('colorPicker') as HTMLInputElement;
    colorPicker?.addEventListener('change', (e) => {
      const color = (e.target as HTMLInputElement).value;
      this.canvasManager.setColor(color);
    });

    // Color presets
    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.getAttribute('data-color');
        if (color) {
          this.canvasManager.setColor(color);
          if (colorPicker) {
            colorPicker.value = color;
          }
        }
      });
    });

    // Line width
    const lineWidth = document.getElementById('lineWidth') as HTMLInputElement;
    const lineWidthValue = document.getElementById('lineWidthValue');
    
    lineWidth?.addEventListener('input', (e) => {
      const width = parseInt((e.target as HTMLInputElement).value);
      this.canvasManager.setLineWidth(width);
      if (lineWidthValue) {
        lineWidthValue.textContent = `${width}px`;
      }
    });

    // Undo/Redo
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const clearBtn = document.getElementById('clearBtn');

    undoBtn?.addEventListener('click', () => {
      this.websocketManager.sendUndo();
    });

    redoBtn?.addEventListener('click', () => {
      this.websocketManager.sendRedo();
    });

    clearBtn?.addEventListener('click', () => {
      if (confirm('Clear the entire canvas? This cannot be undone.')) {
        // Clear locally immediately for better UX
        this.canvasManager.clear();
        // Send clear event to server to sync with all other users
        this.websocketManager.sendClear();
      }
    });

    // Cursor tracking on canvas
    const canvas = document.getElementById('drawingCanvas') as HTMLCanvasElement;
    if (canvas) {
      canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const point: Point = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
        this.websocketManager.sendCursorMove(point);
      });
    }
  }

  private setupWebSocket(): void {
    this.websocketManager.connect();

    this.websocketManager.setCallbacks({
      onConnected: () => {
        const statusEl = document.getElementById('connectionStatus');
        if (statusEl) {
          statusEl.textContent = '● Connected';
          statusEl.className = 'status connected';
        }
      },
      onDisconnected: () => {
        const statusEl = document.getElementById('connectionStatus');
        if (statusEl) {
          statusEl.textContent = '● Disconnected';
          statusEl.className = 'status disconnected';
        }
      },
      onUserJoined: (user, users) => {
        console.log('User joined event received:', user, users);
        console.log('Current user ID:', this.currentUserId);
        
        // If we don't have a currentUserId yet, this is likely us
        // Or if the user ID matches, it's definitely us
        if (!this.currentUserId || user.id === this.currentUserId) {
          console.log('Setting current user ID to:', user.id);
          this.currentUserId = user.id;
          this.canvasManager.setUserId(user.id);
          this.websocketManager.setUserId(user.id);
        }
        
        this.updateUsersList(users);
      },
      onUserLeft: (userId, users) => {
        this.users.delete(userId);
        this.canvasManager.removeUserCursor(userId);
        this.updateUsersList(users);
      },
      onDrawingStart: (stroke) => {
        this.canvasManager.drawRemoteStrokeStart(stroke);
      },
      onDrawingMove: (strokeId, point) => {
        this.canvasManager.drawRemoteStrokeMove(strokeId, point);
      },
      onDrawingEnd: (stroke) => {
        this.canvasManager.drawRemoteStrokeEnd(stroke);
      },
      onCursorMove: (userId, point) => {
        const user = this.users.get(userId);
        if (user) {
          user.cursorPosition = point;
          this.canvasManager.updateUserCursor(userId, user, point);
        }
      },
      onUndo: (strokeId) => {
        this.canvasManager.undo(strokeId);
      },
      onRedo: (stroke) => {
        this.canvasManager.redo(stroke);
      },
      onClear: (roomId) => {
        console.log('Clear event received for room:', roomId);
        this.canvasManager.clear();
      },
      onStateSync: (strokes, users) => {
        console.log('State sync received:', { strokes: strokes.length, users: users.length });
        this.canvasManager.syncState(strokes);
        this.updateUsersList(users);
        // Store users
        users.forEach(user => {
          this.users.set(user.id, user);
          // If we don't have a currentUserId yet, use the first user (likely us)
          // Or if it matches, it's definitely us
          if (!this.currentUserId || user.id === this.currentUserId) {
            console.log('Setting current user ID from stateSync:', user.id);
            this.currentUserId = user.id;
            this.canvasManager.setUserId(user.id);
            this.websocketManager.setUserId(user.id);
          }
        });
      },
      onError: (message) => {
        alert(`Error: ${message}`);
      }
    });
  }

  private setupCanvasCallbacks(): void {
    this.canvasManager.setCallbacks({
      onStrokeStart: (stroke) => {
        if (stroke.points.length > 0) {
          this.websocketManager.sendDrawingStart(
            stroke.points[0],
            stroke.tool,
            stroke.color,
            stroke.lineWidth
          );
        }
      },
      onStrokeMove: (strokeId, point) => {
        this.websocketManager.sendDrawingMove(point);
      },
      onStrokeEnd: (strokeId) => {
        this.websocketManager.sendDrawingEnd(strokeId);
      }
    });
  }

  private updateUsersList(users: User[]): void {
    const usersList = document.getElementById('usersList');
    if (!usersList) return;

    // Update users map
    users.forEach(user => {
      this.users.set(user.id, user);
    });

    // Update count
    const userCount = document.getElementById('userCount');
    if (userCount) {
      userCount.textContent = `${users.length} user${users.length !== 1 ? 's' : ''} online`;
    }

    // Update list
    usersList.innerHTML = '';
    users.forEach(user => {
      const userItem = document.createElement('div');
      userItem.className = 'user-item';
      userItem.innerHTML = `
        <div class="user-color-indicator" style="background: ${user.color}"></div>
        <span class="user-name">${user.name}</span>
      `;
      usersList.appendChild(userItem);
    });
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new App();
  });
} else {
  new App();
}

