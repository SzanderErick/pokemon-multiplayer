import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

@Entity('scores')
export class ScoreEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  playerName: string

  @Column()
  character: string

  @Column()
  pts: number

  @Column()
  caught: number

  @CreateDateColumn()
  createdAt: Date
}
