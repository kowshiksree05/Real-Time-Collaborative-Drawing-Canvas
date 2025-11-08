"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const drawing_state_1 = require("./drawing-state");
const rooms_1 = require("./rooms");
const uuid_1 = require("uuid");
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
// Initialize Socket.io FIRST (so it can serve its client library)
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    // Socket.io v4 serves client by default, but be explicit
    serveClient: true,
    // Ensure client is accessible
    path: '/socket.io/'
});
// Serve static files AFTER Socket.io (so Socket.io routes take precedence)
// __dirname is dist/server when compiled, so go up to root then into client
const clientPath = path_1.default.join(__dirname, '../../client');
app.use(express_1.default.static(clientPath, {
    // Ensure proper MIME types for ES modules
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));
// Default route
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(clientPath, 'index.html'));
});
// Debug route to test if files are being served
app.get('/test', (req, res) => {
    res.json({
        message: 'Server is running',
        clientPath: clientPath,
        files: ['main.js', 'websocket.js', 'canvas.js'].map(f => {
            const fs = require('fs');
            const filePath = path_1.default.join(clientPath, f);
            return {
                file: f,
                exists: fs.existsSync(filePath),
                path: filePath
            };
        })
    });
});
const drawingState = new drawing_state_1.DrawingStateManager();
const roomManager = new rooms_1.RoomManager();
const activeStrokes = new Map();
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    // Create user for this socket
    const user = roomManager.createUser();
    const userRooms = new Set();
    socket.on('joinRoom', (roomId, userName) => {
        try {
            // Create room if it doesn't exist
            drawingState.createRoom(roomId);
            // Update user name if provided
            if (userName) {
                user.name = userName;
            }
            // Add user to room
            drawingState.addUser(roomId, user);
            socket.join(roomId);
            userRooms.add(roomId);
            // Send current state to the new user
            const strokes = drawingState.getAllStrokes(roomId);
            const users = drawingState.getAllUsers(roomId);
            // Send user ID to client
            socket.emit('userJoined', { user, users });
            socket.emit('stateSync', { strokes, users });
            // Notify other users
            socket.to(roomId).emit('userJoined', { user, users });
            console.log(`User ${user.name} (${user.id}) joined room ${roomId}`);
        }
        catch (error) {
            socket.emit('error', { message: 'Failed to join room' });
            console.error('Error joining room:', error);
        }
    });
    socket.on('leaveRoom', (roomId) => {
        try {
            drawingState.removeUser(roomId, user.id);
            socket.leave(roomId);
            userRooms.delete(roomId);
            const users = drawingState.getAllUsers(roomId);
            socket.to(roomId).emit('userLeft', { userId: user.id, users });
            console.log(`User ${user.name} left room ${roomId}`);
        }
        catch (error) {
            console.error('Error leaving room:', error);
        }
    });
    socket.on('drawingStart', (data) => {
        try {
            const { roomId, point, tool, color, lineWidth } = data;
            if (!userRooms.has(roomId)) {
                return;
            }
            const strokeId = (0, uuid_1.v4)();
            const stroke = {
                id: strokeId,
                userId: user.id,
                tool: tool,
                color,
                lineWidth,
                points: [point],
                timestamp: Date.now()
            };
            // Store active stroke
            activeStrokes.set(socket.id, {
                strokeId,
                userId: user.id,
                tool,
                color,
                lineWidth,
                points: [point]
            });
            // Add to state
            drawingState.addStroke(roomId, stroke);
            // Broadcast to others in room
            socket.to(roomId).emit('drawingStart', { stroke });
            socket.emit('drawingStart', { stroke });
        }
        catch (error) {
            console.error('Error in drawingStart:', error);
        }
    });
    socket.on('drawingMove', (data) => {
        try {
            const { roomId, point } = data;
            if (!userRooms.has(roomId)) {
                return;
            }
            const activeStroke = activeStrokes.get(socket.id);
            if (activeStroke) {
                activeStroke.points.push(point);
                drawingState.updateStroke(roomId, activeStroke.strokeId, point);
                // Broadcast to others
                socket.to(roomId).emit('drawingMove', {
                    strokeId: activeStroke.strokeId,
                    point
                });
            }
        }
        catch (error) {
            console.error('Error in drawingMove:', error);
        }
    });
    socket.on('drawingEnd', (data) => {
        try {
            const { roomId, strokeId } = data;
            if (!userRooms.has(roomId)) {
                return;
            }
            const activeStroke = activeStrokes.get(socket.id);
            if (activeStroke && activeStroke.strokeId === strokeId) {
                const finalStroke = drawingState.finalizeStroke(roomId, strokeId);
                if (finalStroke) {
                    socket.to(roomId).emit('drawingEnd', { stroke: finalStroke });
                }
                activeStrokes.delete(socket.id);
            }
        }
        catch (error) {
            console.error('Error in drawingEnd:', error);
        }
    });
    socket.on('cursorMove', (data) => {
        try {
            const { roomId, point } = data;
            if (!userRooms.has(roomId)) {
                return;
            }
            drawingState.updateUserCursor(roomId, user.id, point);
            socket.to(roomId).emit('cursorMove', { userId: user.id, point });
        }
        catch (error) {
            console.error('Error in cursorMove:', error);
        }
    });
    socket.on('undo', (data) => {
        try {
            const { roomId } = data;
            if (!userRooms.has(roomId)) {
                return;
            }
            const strokeId = drawingState.undo(roomId, user.id);
            if (strokeId) {
                io.to(roomId).emit('undo', { strokeId });
            }
        }
        catch (error) {
            console.error('Error in undo:', error);
        }
    });
    socket.on('redo', (data) => {
        try {
            const { roomId } = data;
            if (!userRooms.has(roomId)) {
                return;
            }
            const stroke = drawingState.redo(roomId, user.id);
            if (stroke) {
                io.to(roomId).emit('redo', { stroke });
            }
        }
        catch (error) {
            console.error('Error in redo:', error);
        }
    });
    socket.on('clear', (data) => {
        try {
            const { roomId } = data;
            if (!userRooms.has(roomId)) {
                return;
            }
            // Clear the room state
            drawingState.clearRoom(roomId);
            // Broadcast clear to all users in the room
            // Note: io.to() excludes the sender, but sender already cleared locally
            io.to(roomId).emit('clear', { roomId });
            console.log(`User ${user.name} cleared room ${roomId}`);
        }
        catch (error) {
            console.error('Error in clear:', error);
        }
    });
    socket.on('requestState', (data) => {
        try {
            const { roomId } = data;
            const strokes = drawingState.getAllStrokes(roomId);
            const users = drawingState.getAllUsers(roomId);
            socket.emit('stateSync', { strokes, users });
        }
        catch (error) {
            console.error('Error in requestState:', error);
        }
    });
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Clean up active strokes
        activeStrokes.delete(socket.id);
        // Remove user from all rooms
        userRooms.forEach(roomId => {
            drawingState.removeUser(roomId, user.id);
            const users = drawingState.getAllUsers(roomId);
            io.to(roomId).emit('userLeft', { userId: user.id, users });
        });
    });
});
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
//# sourceMappingURL=server.js.map