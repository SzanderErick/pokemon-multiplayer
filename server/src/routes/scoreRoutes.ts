import { Router } from 'express'
import { ScoreController } from '../infrastructure/controllers/ScoreController'

export const createScoreRoutes = (scoreController: ScoreController): Router => {
  const router = Router()
  router.get('/', scoreController.getLeaderboard)
  router.post('/', scoreController.saveScore)
  return router
}
