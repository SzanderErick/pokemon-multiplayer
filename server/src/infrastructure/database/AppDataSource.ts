import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { ScoreEntity } from '../entities/ScoreEntity'

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'admin',
  password: 'password',
  database: 'pokemon',
  synchronize: true,
  logging: false,
  entities: [ScoreEntity]
})
