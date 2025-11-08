export class WebSocketManager {
    constructor() {
        this.socket = null;
        this.roomId = 'default';
        this.currentUserId = '';
        this.pendingJoin = null;
    }
    connect(serverUrl = window.location.origin) {
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
        socket.on('userJoined', (data) => {
            if (this.onUserJoined) {
                this.onUserJoined(data.user, data.users);
            }
        });
        socket.on('userLeft', (data) => {
            if (this.onUserLeft) {
                this.onUserLeft(data.userId, data.users);
            }
        });
        socket.on('drawingStart', (data) => {
            if (this.onDrawingStart) {
                this.onDrawingStart(data.stroke);
            }
        });
        socket.on('drawingMove', (data) => {
            if (this.onDrawingMove) {
                this.onDrawingMove(data.strokeId, data.point);
            }
        });
        socket.on('drawingEnd', (data) => {
            if (this.onDrawingEnd) {
                this.onDrawingEnd(data.stroke);
            }
        });
        socket.on('cursorMove', (data) => {
            if (this.onCursorMove) {
                this.onCursorMove(data.userId, data.point);
            }
        });
        socket.on('undo', (data) => {
            if (this.onUndo) {
                this.onUndo(data.strokeId);
            }
        });
        socket.on('redo', (data) => {
            if (this.onRedo && data.stroke) {
                this.onRedo(data.stroke);
            }
        });
        socket.on('clear', (data) => {
            if (this.onClear) {
                this.onClear(data.roomId);
            }
        });
        socket.on('stateSync', (data) => {
            if (this.onStateSync) {
                this.onStateSync(data.strokes, data.users);
            }
        });
        socket.on('error', (data) => {
            console.error('Server error:', data.message);
            if (this.onError) {
                this.onError(data.message);
            }
        });
    }
    setCallbacks(callbacks) {
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
    joinRoom(roomId, userName) {
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
    leaveRoom(roomId) {
        if (!this.socket)
            return;
        this.socket.emit('leaveRoom', roomId);
    }
    sendDrawingStart(point, tool, color, lineWidth) {
        if (!this.socket || !this.socket.connected)
            return;
        this.socket.emit('drawingStart', {
            roomId: this.roomId,
            point,
            tool,
            color,
            lineWidth
        });
    }
    sendDrawingMove(point) {
        if (!this.socket || !this.socket.connected)
            return;
        this.socket.emit('drawingMove', {
            roomId: this.roomId,
            point
        });
    }
    sendDrawingEnd(strokeId) {
        if (!this.socket || !this.socket.connected)
            return;
        this.socket.emit('drawingEnd', {
            roomId: this.roomId,
            strokeId
        });
    }
    sendCursorMove(point) {
        if (!this.socket || !this.socket.connected)
            return;
        this.socket.emit('cursorMove', {
            roomId: this.roomId,
            point
        });
    }
    sendUndo() {
        if (!this.socket || !this.socket.connected)
            return;
        this.socket.emit('undo', {
            roomId: this.roomId
        });
    }
    sendRedo() {
        if (!this.socket || !this.socket.connected)
            return;
        this.socket.emit('redo', {
            roomId: this.roomId
        });
    }
    sendClear() {
        if (!this.socket || !this.socket.connected)
            return;
        this.socket.emit('clear', {
            roomId: this.roomId
        });
    }
    requestState() {
        if (!this.socket || !this.socket.connected)
            return;
        this.socket.emit('requestState', {
            roomId: this.roomId
        });
    }
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
    isConnected() {
        return this.socket?.connected || false;
    }
    setUserId(userId) {
        this.currentUserId = userId;
    }
    getRoomId() {
        return this.roomId;
    }
}
//# sourceMappingURL=websocket.js.map