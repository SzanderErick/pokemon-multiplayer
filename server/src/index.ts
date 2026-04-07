import 'reflect-metadata'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import path from 'path'
import { AppDataSource } from './infrastructure/database/AppDataSource'
import { ScoreRepositoryPostgres } from './infrastructure/repositories/ScoreRepositoryPostgres'
import { ScoreService } from './application/services/ScoreService'
import { ScoreController } from './infrastructure/controllers/ScoreController'
import { createScoreRoutes } from './routes/scoreRoutes'
import { Player } from './domain/entities/Player'

const app    = express()
const http   = createServer(app)
const io     = new Server(http, { cors: { origin: '*' } })

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, '../../client')))

const scoreRepository = new ScoreRepositoryPostgres()
const scoreService    = new ScoreService(scoreRepository)
const scoreController = new ScoreController(scoreService)
app.use('/scores', createScoreRoutes(scoreController))

const FACTS = [
  "El primer videojuego fue Tennis for Two en 1958, creado por el fisico William Higinbotham.",
  "Satoshi Tajiri creo Pokemon inspirado en su hobby de coleccionar insectos en Japon.",
  "Ada Lovelace fue la primera programadora de la historia en 1843.",
  "Doom 1993 fue tan popular que habia mas copias instaladas que Windows en PCs ese anio.",
  "Shigeru Miyamoto, creador de Mario y Zelda, estudio diseno industrial no programacion."
]

const GHOST_CONFIG: Record<string, any> = {
  'gastly':        { timeLimit:6000, giveRank:1,  loseRank:3, ballLoss:5, evolveChance:0.50, evolveTo:'haunter', shiny:false },
  'haunter':       { timeLimit:5000, giveRank:5,  loseRank:5, ballLoss:5, evolveChance:0.65, evolveTo:'gengar',  shiny:false },
  'gengar':        { timeLimit:4000, giveRank:21, loseRank:7, ballLoss:7, evolveChance:0,    evolveTo:null,      shiny:false },
  'gastly-shiny':  { timeLimit:6000, giveRank:1,  loseRank:3, ballLoss:5, evolveChance:0,    evolveTo:null,      shiny:true  },
  'haunter-shiny': { timeLimit:5000, giveRank:5,  loseRank:5, ballLoss:5, evolveChance:0,    evolveTo:null,      shiny:true  },
  'gengar-shiny':  { timeLimit:4000, giveRank:21, loseRank:7, ballLoss:7, evolveChance:0,    evolveTo:null,      shiny:true  }
}

const LEVELS = [
  { minPts:0,   rank:'pokeball',   scenario:1, label:'POKEBALL'   },
  { minPts:10,  rank:'superball',  scenario:2, label:'SUPERBALL'  },
  { minPts:20,  rank:'ultraball',  scenario:3, label:'ULTRABALL'  },
  { minPts:50,  rank:'masterball', scenario:4, label:'MASTERBALL' },
  { minPts:100, rank:'maestro',    scenario:5, label:'MAESTRO'    }
]

function getLevel(pts: number) {
  return [...LEVELS].reverse().find(l => pts >= l.minPts) || LEVELS[0]
}

const players   = new Map<string, Player>()
let currentGhost: any = null
let ghostTimer: NodeJS.Timeout | null = null

function getGhostType(avgPts: number): string {
  const r = Math.random()
  let base: string
  if      (avgPts >= 50) base = r < 0.55 ? 'haunter' : 'gengar'
  else if (avgPts >= 20) base = r < 0.15 ? 'gengar'  : 'haunter'
  else if (avgPts >= 10) base = r < 0.15 ? 'haunter' : 'gastly'
  else                   base = 'gastly'
  const shinyChance = base === 'gastly' ? 0.20 : 0.40
  return Math.random() < shinyChance ? `${base}-shiny` : base
}

function broadcastState() {
  io.emit('game-state', { players: [...players.values()], ghost: currentGhost })
}

function scheduleNextGhost(delay = 2000) {
  const alive = [...players.values()].filter(p => p.isAlive && !p.isSpectator)
  if (alive.length > 0) setTimeout(spawnGhost, delay + Math.random() * 2000)
}

async function handlePlayerDeath(player: Player, fact: string) {
  player.isAlive = false
  io.to(player.socketId).emit('game-over', { pts: player.pts, caught: player.caught, fact })
  try { await scoreService.saveScore(player.name, player.character, player.pts, player.caught) }
  catch (e) { console.error('Error guardando score:', e) }
}

function spawnGhost(type?: string) {
  const alive = [...players.values()].filter(p => p.isAlive && !p.isSpectator)
  if (alive.length === 0) return
  const avgPts = alive.reduce((s, p) => s + p.pts, 0) / alive.length
  const gType  = type || getGhostType(avgPts)
  const cfg    = GHOST_CONFIG[gType]
  if (!cfg) return
  currentGhost = {
    id:   Date.now().toString(),
    type: gType,
    x:    Math.floor(Math.random() * 600) + 100,
    y:    Math.floor(Math.random() * 350) + 100,
    cfg
  }
  io.emit('ghost-spawned', currentGhost)
  ghostTimer = setTimeout(async () => {
    if (!currentGhost) return
    const escaped = { ...currentGhost }
    currentGhost  = null
    const stillAlive = [...players.values()].filter(p => p.isAlive && !p.isSpectator)
    for (const p of stillAlive) {
      p.pokeballs = Math.max(0, p.pokeballs - escaped.cfg.ballLoss)
      p.pts       = Math.max(0, p.pts - escaped.cfg.loseRank)
      io.to(p.socketId).emit('ghost-escaped', {
        ghostType: escaped.type,
        ballLoss:  escaped.cfg.ballLoss,
        ptLoss:    escaped.cfg.loseRank
      })
      if (p.pokeballs <= 0) {
        const fact = FACTS[Math.floor(Math.random() * FACTS.length)]
        await handlePlayerDeath(p, fact)
      }
    }
    broadcastState()
    scheduleNextGhost()
  }, cfg.timeLimit)
}

io.on('connection', (socket) => {
  console.log('Conectado:', socket.id)

  socket.on('join-game', (data: { name: string, character: 'ash' | 'misty' | 'brock', isSpectator: boolean }) => {
    const player = new Player(
      socket.id, data.name, data.character,
      0, 5, 0,
      300 + Math.random() * 200,
      200 + Math.random() * 200,
      data.isSpectator || false,
      true
    )
    players.set(socket.id, player)
    socket.emit('joined', { socketId: socket.id })
    broadcastState()
    const alive = [...players.values()].filter(p => p.isAlive && !p.isSpectator)
    if (alive.length === 1 && !currentGhost) setTimeout(spawnGhost, 2000)
  })

  socket.on('player-move', (data: { x: number, y: number, dir: string, moving: boolean }) => {
    const p = players.get(socket.id)
    if (!p || !p.isAlive) return
    p.x = data.x; p.y = data.y
    socket.broadcast.emit('player-moved', { socketId: socket.id, ...data })
  })

  socket.on('catch-ghost', async (data: { ghostId: string, inVision: boolean }) => {
    const player = players.get(socket.id)
    if (!player || !player.isAlive || !currentGhost) return
    if (currentGhost.id !== data.ghostId) return
    const caught = { ...currentGhost }
    currentGhost = null
    if (ghostTimer) { clearTimeout(ghostTimer); ghostTimer = null }
    player.pokeballs = Math.max(0, player.pokeballs - 1)
    player.pts      += caught.cfg.giveRank
    player.caught   += 1
    let visionBonus = false
    if (data.inVision) {
      player.pts      += 3
      player.pokeballs = Math.min(player.pokeballs + 1, 99)
      visionBonus = true
    }
    if (caught.cfg.shiny) {
      player.pokeballs = Math.min(player.pokeballs + 5, 99)
      player.pts      += 3
      io.to(socket.id).emit('shiny-bonus')
    }
    const prevPts   = player.pts - caught.cfg.giveRank - (visionBonus ? 3 : 0)
    const prevLevel = getLevel(prevPts)
    const newLevel  = getLevel(player.pts)
    if (newLevel.rank !== prevLevel.rank) {
      io.to(socket.id).emit('level-up', newLevel)
    }
    io.emit('ghost-caught', {
      ghostType:   caught.type,
      caughtBy:    { socketId: socket.id, name: player.name, character: player.character },
      pts:         caught.cfg.giveRank + (visionBonus ? 3 : 0),
      visionBonus
    })
    if (player.pts >= 100) {
      player.isAlive = false
      io.to(socket.id).emit('victory', { pts: player.pts, caught: player.caught })
      try { await scoreService.saveScore(player.name, player.character, player.pts, player.caught) } catch {}
      broadcastState(); return
    }
    broadcastState()
    const delay = 1500 + Math.random() * 1500
    if (caught.cfg.evolveChance > 0 && Math.random() < caught.cfg.evolveChance) {
      io.emit('ghost-evolving', { evolveTo: caught.cfg.evolveTo })
      setTimeout(() => spawnGhost(caught.cfg.evolveTo), delay)
    } else {
      setTimeout(() => scheduleNextGhost(0), delay)
    }
  })

  socket.on('miss-ghost', async () => {
    const p = players.get(socket.id)
    if (!p || !p.isAlive) return
    p.pokeballs = Math.max(0, p.pokeballs - 2)
    if (p.pokeballs <= 0) {
      const fact = FACTS[Math.floor(Math.random() * FACTS.length)]
      await handlePlayerDeath(p, fact)
    }
    socket.emit('miss-result', { pokeballs: p.pokeballs })
    broadcastState()
  })

  socket.on('request-leaderboard', async () => {
    const scores = await scoreService.getLeaderboard(10)
    socket.emit('leaderboard', scores)
  })

  socket.on('disconnect', () => {
    players.delete(socket.id)
    broadcastState()
    console.log('Desconectado:', socket.id)
  })
})

AppDataSource.initialize()
  .then(() => {
    console.log('PostgreSQL conectado')
    http.listen(3000, () => {
      console.log('Pokemon Multiplayer -> http://localhost:3000')
    })
  })
  .catch((err) => {
    console.error('Error DB:', err)
    process.exit(1)
  })
