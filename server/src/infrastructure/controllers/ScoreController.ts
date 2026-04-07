import { Request, Response } from 'express'
import { ScoreService } from '../../application/services/ScoreService'

export class ScoreController {
  constructor(private scoreService: ScoreService) {}

  getLeaderboard = async (req: Request, res: Response): Promise<void> => {
    const scores = await this.scoreService.getLeaderboard(10)
    res.json(scores)
  }

  saveScore = async (req: Request, res: Response): Promise<void> => {
    const { playerName, character, pts, caught } = req.body
    const score = await this.scoreService.saveScore(playerName, character, pts, caught)
    res.json(score)
  }
}
