import { RoomState, DrawingStroke, User, RedoItem } from './types';
import { v4 as uuidv4 } from 'uuid';

export class DrawingStateManager {
  private rooms: Map<string, RoomState> = new Map();

  createRoom(roomId: string): void {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        strokes: [],
        users: new Map(),
        undoStack: [],
        redoStack: []
      });
    }
  }

  getRoom(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId);
  }

  addUser(roomId: string, user: User): void {
    const room = this.getRoom(roomId);
    if (room) {
      room.users.set(user.id, user);
    }
  }

  removeUser(roomId: string, userId: string): void {
    const room = this.getRoom(roomId);
    if (room) {
      room.users.delete(userId);
    }
  }

  updateUserCursor(roomId: string, userId: string, point: { x: number; y: number }): void {
    const room = this.getRoom(roomId);
    if (room) {
      const user = room.users.get(userId);
      if (user) {
        user.cursorPosition = point;
      }
    }
  }

  addStroke(roomId: string, stroke: DrawingStroke): void {
    const room = this.getRoom(roomId);
    if (room) {
      room.strokes.push(stroke);
      // Clear redo stack when new stroke is added
      room.redoStack = [];
      // Add to undo stack
      room.undoStack.push(stroke.id);
    }
  }

  updateStroke(roomId: string, strokeId: string, point: { x: number; y: number }): void {
    const room = this.getRoom(roomId);
    if (room) {
      const stroke = room.strokes.find(s => s.id === strokeId);
      if (stroke) {
        stroke.points.push(point);
      }
    }
  }

  finalizeStroke(roomId: string, strokeId: string): DrawingStroke | null {
    const room = this.getRoom(roomId);
    if (room) {
      const stroke = room.strokes.find(s => s.id === strokeId);
      return stroke || null;
    }
    return null;
  }

  undo(roomId: string, userId: string): string | null {
    const room = this.getRoom(roomId);
    if (!room || room.undoStack.length === 0) {
      return null;
    }

    // Find the most recent stroke by this user
    let strokeId: string | null = null;
    for (let i = room.undoStack.length - 1; i >= 0; i--) {
      const id = room.undoStack[i];
      const stroke = room.strokes.find(s => s.id === id);
      if (stroke && stroke.userId === userId) {
        strokeId = id;
        break;
      }
    }

    if (strokeId) {
      // Find and store the stroke before removing
      const stroke = room.strokes.find(s => s.id === strokeId);
      if (!stroke) return null;

      // Remove from strokes array
      const index = room.strokes.findIndex(s => s.id === strokeId);
      if (index !== -1) {
        room.strokes.splice(index, 1);
      }

      // Remove from undo stack and add to redo stack with stroke data
      const undoIndex = room.undoStack.indexOf(strokeId);
      if (undoIndex !== -1) {
        room.undoStack.splice(undoIndex, 1);
        room.redoStack.push({ strokeId, stroke: { ...stroke } });
      }

      return strokeId;
    }

    return null;
  }

  redo(roomId: string, userId: string): DrawingStroke | null {
    const room = this.getRoom(roomId);
    if (!room || room.redoStack.length === 0) {
      return null;
    }

    // Find the most recent redoable stroke by this user
    let redoItem: RedoItem | null = null;
    for (let i = room.redoStack.length - 1; i >= 0; i--) {
      const item = room.redoStack[i];
      if (item.stroke.userId === userId) {
        redoItem = item;
        break;
      }
    }

    if (redoItem) {
      // Restore the stroke
      room.strokes.push(redoItem.stroke);
      
      // Remove from redo stack and add back to undo stack
      const redoIndex = room.redoStack.indexOf(redoItem);
      if (redoIndex !== -1) {
        room.redoStack.splice(redoIndex, 1);
        room.undoStack.push(redoItem.strokeId);
      }

      return redoItem.stroke;
    }

    return null;
  }

  getAllStrokes(roomId: string): DrawingStroke[] {
    const room = this.getRoom(roomId);
    return room ? [...room.strokes] : [];
  }

  getAllUsers(roomId: string): User[] {
    const room = this.getRoom(roomId);
    if (!room) {
      return [];
    }
    return Array.from(room.users.values());
  }

  clearRoom(roomId: string): void {
    const room = this.getRoom(roomId);
    if (room) {
      room.strokes = [];
      room.undoStack = [];
      room.redoStack = [];
    }
  }

  deleteRoom(roomId: string): void {
    this.rooms.delete(roomId);
  }
}

