// io is loaded globally via script tag in index.html
declare const io: any;
import { DrawingStroke, Point, User } from './types.js';

interface Socket {
  on(event: string, callback: (data?: any) => void): void;
  emit(event: string, ...args: any[]): void;
  disconnect(): void;
  connected: boolean;
}

export class WebSocketManager {
  private socket: Socket | null = null;
  private roomId: string = 'default';
  private currentUserId: string = '';
  private pendingJoin: { roomId: string; userName?: string } | null = null;

  // Callbacks
  private onUserJoined?: (user: User, users: User[]) => void;
  private onUserLeft?: (userId: string, users: User[]) => void;
  private onDrawingStart?: (stroke: DrawingStroke) => void;
  private onDrawingMove?: (strokeId: string, point: Point) => void;
  private onDrawingEnd?: (stroke: DrawingStroke) => void;
  private onCursorMove?: (userId: string, point: Point) => void;
  private onUndo?: (strokeId: string) => void;
  private onRedo?: (stroke: DrawingStroke) => void;
  private onClear?: (roomId: string) => void;
  private onStateSync?: (strokes: DrawingStroke[], users: User[]) => void;
  private onError?: (message: string) => void;
  private onConnected?: () => void;
  private onDisconnected?: () => void;

  connect(serverUrl: string = window.location.origin): void {
    // Wait a bit for Socket.io library to load if it's not ready
    if (typeof io === 'undefined') {
      console.error('Socket.io client library not loaded. Make sure /socket.io/socket.io.js is accessible.');
      console.error('Trying to load Socket.io client manually...');
      
      // Try to load it manually
      const script = document.createElement('script');
      script.src = '/socket.io/socket.io.js';
      script.onload = () => {
        console.log('Socket.io client loaded, retrying connection...');
        this.connect(serverUrl);
      };
      script.onerror = () => {
        console.error('Failed to load Socket.io client library from /socket.io/socket.io.js');
        alert('Failed to load Socket.io client library. Please check the server is running and Socket.io is properly configured.');
      };
      document.head.appendChild(script);
      return;
    }

    console.log('Connecting to server at:', serverUrl);
    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });
    this.socket = socket;

    socket.on('connect', () => {
      console.log('Connected to server');
      if (this.onConnected) {
        this.onConnected();
      }
      // Execute pending join request if any
      if (this.pendingJoin) {
        console.log('Executing pending join:', this.pendingJoin);
        if (this.socket) {
          this.roomId = this.pendingJoin.roomId;
          this.socket.emit('joinRoom', this.pendingJoin.roomId, this.pendingJoin.userName);
          this.pendingJoin = null;
        }
      }
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      if (this.onDisconnected) {
        this.onDisconnected();
      }
    });

    socket.on('userJoined', (data: any) => {
      if (this.onUserJoined) {
        this.onUserJoined(data.user, data.users);
      }
    });

    socket.on('userLeft', (data: any) => {
      if (this.onUserLeft) {
        this.onUserLeft(data.userId, data.users);
      }
    });

    socket.on('drawingStart', (data: any) => {
      if (this.onDrawingStart) {
        this.onDrawingStart(data.stroke);
      }
    });

    socket.on('drawingMove', (data: any) => {
      if (this.onDrawingMove) {
        this.onDrawingMove(data.strokeId, data.point);
      }
    });

    socket.on('drawingEnd', (data: any) => {
      if (this.onDrawingEnd) {
        this.onDrawingEnd(data.stroke);
      }
    });

    socket.on('cursorMove', (data: any) => {
      if (this.onCursorMove) {
        this.onCursorMove(data.userId, data.point);
      }
    });

    socket.on('undo', (data: any) => {
      if (this.onUndo) {
        this.onUndo(data.strokeId);
      }
    });

    socket.on('redo', (data: any) => {
      if (this.onRedo && data.stroke) {
        this.onRedo(data.stroke);
      }
    });

    socket.on('clear', (data: any) => {
      if (this.onClear) {
        this.onClear(data.roomId);
      }
    });

    socket.on('stateSync', (data: any) => {
      if (this.onStateSync) {
        this.onStateSync(data.strokes, data.users);
      }
    });

    socket.on('error', (data: any) => {
      console.error('Server error:', data.message);
      if (this.onError) {
        this.onError(data.message);
      }
    });
  }

  setCallbacks(callbacks: {
    onUserJoined?: (user: User, users: User[]) => void;
    onUserLeft?: (userId: string, users: User[]) => void;
    onDrawingStart?: (stroke: DrawingStroke) => void;
    onDrawingMove?: (strokeId: string, point: Point) => void;
    onDrawingEnd?: (stroke: DrawingStroke) => void;
    onCursorMove?: (userId: string, point: Point) => void;
    onUndo?: (strokeId: string) => void;
    onRedo?: (stroke: DrawingStroke) => void;
    onClear?: (roomId: string) => void;
    onStateSync?: (strokes: DrawingStroke[], users: User[]) => void;
    onError?: (message: string) => void;
    onConnected?: () => void;
    onDisconnected?: () => void;
  }): void {
    this.onUserJoined = callbacks.onUserJoined;
    this.onUserLeft = callbacks.onUserLeft;
    this.onDrawingStart = callbacks.onDrawingStart;
    this.onDrawingMove = callbacks.onDrawingMove;
    this.onDrawingEnd = callbacks.onDrawingEnd;
    this.onCursorMove = callbacks.onCursorMove;
    this.onUndo = callbacks.onUndo;
    this.onRedo = callbacks.onRedo;
    this.onClear = callbacks.onClear;
    this.onStateSync = callbacks.onStateSync;
    this.onError = callbacks.onError;
    this.onConnected = callbacks.onConnected;
    this.onDisconnected = callbacks.onDisconnected;
  }

  joinRoom(roomId: string, userName?: string): boolean {
    if (!this.socket) {
      console.error('Socket not initialized');
      return false;
    }

    if (!this.socket.connected) {
      // Queue the join request until connected
      console.log('Socket not connected yet, queuing join request...');
      this.pendingJoin = { roomId, userName };
      return true; // Return true because we queued it
    }

    this.roomId = roomId;
    console.log('Emitting joinRoom:', roomId, userName);
    this.socket.emit('joinRoom', roomId, userName);
    return true;
  }

  leaveRoom(roomId: string): void {
    if (!this.socket) return;
    this.socket.emit('leaveRoom', roomId);
  }

  sendDrawingStart(point: Point, tool: string, color: string, lineWidth: number): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('drawingStart', {
      roomId: this.roomId,
      point,
      tool,
      color,
      lineWidth
    });
  }

  sendDrawingMove(point: Point): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('drawingMove', {
      roomId: this.roomId,
      point
    });
  }

  sendDrawingEnd(strokeId: string): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('drawingEnd', {
      roomId: this.roomId,
      strokeId
    });
  }

  sendCursorMove(point: Point): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('cursorMove', {
      roomId: this.roomId,
      point
    });
  }

  sendUndo(): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('undo', {
      roomId: this.roomId
    });
  }

  sendRedo(): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('redo', {
      roomId: this.roomId
    });
  }

  sendClear(): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('clear', {
      roomId: this.roomId
    });
  }

  requestState(): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('requestState', {
      roomId: this.roomId
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  setUserId(userId: string): void {
    this.currentUserId = userId;
  }

  getRoomId(): string {
    return this.roomId;
  }
}



