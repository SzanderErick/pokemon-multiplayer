export class Score {
  constructor(
    public id: number | null,
    public playerName: string,
    public character: string,
    public pts: number,
    public caught: number,
    public createdAt: Date = new Date()
  ) {}
}
