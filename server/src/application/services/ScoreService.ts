import { IScoreRepository } from '../../domain/repositories/IScoreRepository'
import { Score } from '../../domain/entities/Score'

export class ScoreService {
  constructor(private scoreRepository: IScoreRepository) {}

  async saveScore(playerName: string, character: string, pts: number, caught: number): Promise<Score> {
    const score = new Score(null, playerName, character, pts, caught)
    return await this.scoreRepository.save(score)
  }

  async getLeaderboard(limit: number = 10): Promise<Score[]> {
    return await this.scoreRepository.getTopScores(limit)
  }
}
