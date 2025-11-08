import { RoomState, DrawingStroke, User } from './types';
export declare class DrawingStateManager {
    private rooms;
    createRoom(roomId: string): void;
    getRoom(roomId: string): RoomState | undefined;
    addUser(roomId: string, user: User): void;
    removeUser(roomId: string, userId: string): void;
    updateUserCursor(roomId: string, userId: string, point: {
        x: number;
        y: number;
    }): void;
    addStroke(roomId: string, stroke: DrawingStroke): void;
    updateStroke(roomId: string, strokeId: string, point: {
        x: number;
        y: number;
    }): void;
    finalizeStroke(roomId: string, strokeId: string): DrawingStroke | null;
    undo(roomId: string, userId: string): string | null;
    redo(roomId: string, userId: string): DrawingStroke | null;
    getAllStrokes(roomId: string): DrawingStroke[];
    getAllUsers(roomId: string): User[];
    clearRoom(roomId: string): void;
    deleteRoom(roomId: string): void;
}
//# sourceMappingURL=drawing-state.d.ts.map