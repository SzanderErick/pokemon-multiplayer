import { Score } from '../entities/Score'

export interface IScoreRepository {
  save(score: Score): Promise<Score>
  getTopScores(limit: number): Promise<Score[]>
}
