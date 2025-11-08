"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomManager = void 0;
const uuid_1 = require("uuid");
// Predefined colors for users
const USER_COLORS = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#FFA07A', // Light Salmon
    '#98D8C8', // Mint
    '#F7DC6F', // Yellow
    '#BB8FCE', // Purple
    '#85C1E2', // Sky Blue
];
class RoomManager {
    constructor() {
        this.userColorIndex = 0;
    }
    generateUserId() {
        return (0, uuid_1.v4)();
    }
    generateUserName() {
        return `User ${Math.floor(Math.random() * 1000)}`;
    }
    assignUserColor() {
        const color = USER_COLORS[this.userColorIndex % USER_COLORS.length];
        this.userColorIndex++;
        return color;
    }
    createUser(name) {
        return {
            id: this.generateUserId(),
            name: name || this.generateUserName(),
            color: this.assignUserColor()
        };
    }
}
exports.RoomManager = RoomManager;
//# sourceMappingURL=rooms.js.map