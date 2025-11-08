# Real-Time Collaborative Drawing Canvas

A multi-user drawing application where multiple people can draw simultaneously on the same canvas with real-time synchronization.

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

```bash
npm install
```

### Running the Application

```bash
npm start
```
## 🚀 Live Demo
[https://real-time-collaborative-drawing-canvas-4zdh.onrender.com](https://real-time-collaborative-drawing-canvas-4zdh.onrender.com)

[![Live Demo](https://img.shields.io/badge/Live-Demo-2ea44f?style=for-the-badge)](https://real-time-collaborative-drawing-canvas-4zdh.onrender.com)

This will:
1. Build the TypeScript code (both server and client)
2. Start the server on `http://localhost:3000`

For development with auto-reload:

```bash
npm run dev
```

### Building

```bash
npm run build
```

This compiles:
- Server code to `dist/server/`
- Client code to `client/` (as ES modules)

## 🧪 Testing with Multiple Users

1. **Start the server**: `npm start`
2. **Open multiple browser windows/tabs** to `http://localhost:3000`
3. **Join a room**: Enter your name and room ID (use the same room ID for all users to collaborate)
4. **Start drawing**: You should see other users' drawings in real-time
5. **Test features**:
   - Draw simultaneously with other users
   - Use different tools (brush, eraser)
   - Change colors and brush sizes
   - Test undo/redo (each user can undo their own strokes)
   - Watch cursor positions of other users

### Testing Scenarios

- **Basic Drawing**: Multiple users drawing at the same time
- **Conflict Resolution**: Two users drawing in overlapping areas
- **Undo/Redo**: User A draws, User B undoes their own stroke, User A undoes their stroke
- **Network Latency**: Test with network throttling in browser DevTools
- **User Management**: Join/leave rooms, see user list update

## 📁 Project Structure

```
collaborative-canvas/
├── client/
│   ├── index.html          # Main HTML file
│   ├── style.css           # Styles
│   ├── types.ts            # TypeScript types
│   ├── canvas.ts           # Canvas drawing logic
│   ├── websocket.ts        # WebSocket client
│   └── main.ts             # App initialization
├── server/
│   ├── server.ts           # Express + Socket.io server
│   ├── rooms.ts            # Room management
│   ├── drawing-state.ts    # Canvas state management
│   └── types.ts            # Shared types
├── package.json
├── tsconfig.json           # Base TypeScript config
├── tsconfig.server.json    # Server-specific config
├── tsconfig.client.json    # Client-specific config
├── README.md
└── ARCHITECTURE.md
```

## 🎯 Features

### ✅ Implemented

- ✅ **Drawing Tools**: Brush and eraser with customizable colors and stroke width
- ✅ **Real-time Sync**: See other users' drawings as they draw (not after they finish)
- ✅ **User Indicators**: Show where other users are currently drawing (cursor positions)
- ✅ **Conflict Resolution**: Handle when multiple users draw in overlapping areas
- ✅ **Global Undo/Redo**: Works across all users (each user can undo their own strokes)
- ✅ **User Management**: Show who's online, assign colors to users
- ✅ **Room System**: Multiple isolated canvases
- ✅ **Mobile Touch Support**: Works on touch devices

### Known Limitations

- **Persistence**: Drawings are not saved to disk (lost on server restart)
- **Performance**: May struggle with 50+ concurrent users (optimization needed)
- **Redo**: Only works for strokes that were undone (not for strokes removed by other users)

## 🐛 Troubleshooting

### Server won't start

- Check if port 3000 is already in use
- Ensure all dependencies are installed: `npm install`
- Check Node.js version: `node --version` (should be v16+)

### Drawings not syncing

- Check browser console for errors
- Verify WebSocket connection (check connection status indicator)
- Ensure all users are in the same room
- Check server logs for errors

### TypeScript compilation errors

- Run `npm install` to ensure all dependencies are installed
- Check TypeScript version: `npx tsc --version`
- Try deleting `dist/` folder and rebuilding

## ⏱️ Time Spent

- **Initial Setup**: 1 hour
- **Server Implementation**: 2 hours
- **Client Canvas Logic**: 3 hours
- **WebSocket Integration**: 2 hours
- **Undo/Redo System**: 2 hours
- **UI/UX Polish**: 1 hour
- **Testing & Bug Fixes**: 1 hour
- **Documentation**: 1 hour

**Total**: ~13 hours

## 🔧 Technical Decisions

- **Socket.io over native WebSockets**: Easier error handling, automatic reconnection, room management
- **TypeScript**: Type safety, better IDE support, easier refactoring
- **Dual Canvas Approach**: Separate canvas for cursors to avoid redrawing main canvas
- **Operation-based Undo**: Each stroke is a single operation, making undo/redo simpler
- **Event-driven Architecture**: Drawing events streamed in real-time for smooth collaboration

## 📝 License

MIT

