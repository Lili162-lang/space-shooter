export type Difficulty = 'easy' | 'normal' | 'hard';

export interface ScorePostBody {
  alias: string;
  points: number;
  maxCombo?: number;
  durationSec?: number;
  metadata:string;
}

export interface ScoreCreated { id: string; }

export interface ScoreTopItem {
  id: string;
  alias: string;
  points: number;
  durationSec: number;
  createdAt: string; // ISO
  maxCombo?: number;
}

export interface ScoreByAliasItem {
  id: string;
  points: number;
  maxCombo?: number;
  durationSec?: number;
  createdAt: string;
}
