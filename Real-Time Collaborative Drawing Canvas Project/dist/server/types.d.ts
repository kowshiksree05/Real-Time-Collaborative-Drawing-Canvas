export interface Point {
    x: number;
    y: number;
}
export interface DrawingStroke {
    id: string;
    userId: string;
    tool: 'brush' | 'eraser';
    color: string;
    lineWidth: number;
    points: Point[];
    timestamp: number;
}
export interface User {
    id: string;
    name: string;
    color: string;
    cursorPosition?: Point;
}
export interface RedoItem {
    strokeId: string;
    stroke: DrawingStroke;
}
export interface RoomState {
    strokes: DrawingStroke[];
    users: Map<string, User>;
    undoStack: string[];
    redoStack: RedoItem[];
}
export interface ClientToServerEvents {
    joinRoom: (roomId: string, userName?: string) => void;
    leaveRoom: (roomId: string) => void;
    drawingStart: (data: {
        roomId: string;
        point: Point;
        tool: string;
        color: string;
        lineWidth: number;
    }) => void;
    drawingMove: (data: {
        roomId: string;
        point: Point;
    }) => void;
    drawingEnd: (data: {
        roomId: string;
        strokeId: string;
    }) => void;
    cursorMove: (data: {
        roomId: string;
        point: Point;
    }) => void;
    undo: (data: {
        roomId: string;
    }) => void;
    redo: (data: {
        roomId: string;
    }) => void;
    clear: (data: {
        roomId: string;
    }) => void;
    requestState: (data: {
        roomId: string;
    }) => void;
}
export interface ServerToClientEvents {
    userJoined: (data: {
        user: User;
        users: User[];
    }) => void;
    userLeft: (data: {
        userId: string;
        users: User[];
    }) => void;
    drawingStart: (data: {
        stroke: DrawingStroke;
    }) => void;
    drawingMove: (data: {
        strokeId: string;
        point: Point;
    }) => void;
    drawingEnd: (data: {
        stroke: DrawingStroke;
    }) => void;
    cursorMove: (data: {
        userId: string;
        point: Point;
    }) => void;
    undo: (data: {
        strokeId: string;
    }) => void;
    redo: (data: {
        stroke: DrawingStroke;
    }) => void;
    clear: (data: {
        roomId: string;
    }) => void;
    stateSync: (data: {
        strokes: DrawingStroke[];
        users: User[];
    }) => void;
    error: (data: {
        message: string;
    }) => void;
}
//# sourceMappingURL=types.d.ts.map