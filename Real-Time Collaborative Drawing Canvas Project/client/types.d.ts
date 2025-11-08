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
//# sourceMappingURL=types.d.ts.map