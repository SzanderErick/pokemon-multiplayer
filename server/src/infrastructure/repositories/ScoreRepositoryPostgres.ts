import { IScoreRepository } from '../../domain/repositories/IScoreRepository'
import { Score } from '../../domain/entities/Score'
import { ScoreEntity } from '../entities/ScoreEntity'
import { AppDataSource } from '../database/AppDataSource'

export class ScoreRepositoryPostgres implements IScoreRepository {
  private repo = AppDataSource.getRepository(ScoreEntity)

  async save(score: Score): Promise<Score> {
    const entity = this.repo.create({
      playerName: score.playerName,
      character: score.character,
      pts: score.pts,
      caught: score.caught
    })
    const saved = await this.repo.save(entity)
    return new Score(saved.id, saved.playerName, saved.character, saved.pts, saved.caught, saved.createdAt)
  }

  async getTopScores(limit: number = 10): Promise<Score[]> {
    const entities = await this.repo.find({
      order: { pts: 'DESC' },
      take: limit
    })
    return entities.map(e => new Score(e.id, e.playerName, e.character, e.pts, e.caught, e.createdAt))
  }
}
