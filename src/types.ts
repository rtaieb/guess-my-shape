export type Player = {
  name: string;
  score: number;
  isHost: boolean;
  turnsLeft?: number;
};

export type Point = {
  x: number;
  y: number;
};

export type Stroke = {
  points: Point[];
  color: string;
  width: number;
};

export type ChatMessage = {
  authorId: string;
  authorName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
  isCorrect?: boolean;
};

export type RoomState = 'lobby' | 'playing' | 'roundEnd' | 'matchEnd';

export type RoomSettings = {
  maxStrokes: number;
  maxTime: number; // in seconds
  matchTurns: number;
};

export type Round = {
  drawerId: string;
  word: string;
  startTime: number;
  correctGuessers: string[];
  strokes?: Record<string, Stroke>;
  chat?: Record<string, ChatMessage>;
};

export type Room = {
  state: RoomState;
  settings: RoomSettings;
  players: Record<string, Player>;
  currentRound?: Round;
  readyPlayers?: string[];
  roundEndTime?: number;
};
