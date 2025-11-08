import { User } from './types';
import { v4 as uuidv4 } from 'uuid';

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

export class RoomManager {
  private userColorIndex = 0;

  generateUserId(): string {
    return uuidv4();
  }

  generateUserName(): string {
    return `User ${Math.floor(Math.random() * 1000)}`;
  }

  assignUserColor(): string {
    const color = USER_COLORS[this.userColorIndex % USER_COLORS.length];
    this.userColorIndex++;
    return color;
  }

  createUser(name?: string): User {
    return {
      id: this.generateUserId(),
      name: name || this.generateUserName(),
      color: this.assignUserColor()
    };
  }
}

