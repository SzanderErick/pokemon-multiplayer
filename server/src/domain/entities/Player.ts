export class Player {
  constructor(
    public socketId: string,
    public name: string,
    public character: 'ash' | 'misty' | 'brock',
    public pts: number = 0,
    public pokeballs: number = 5,
    public caught: number = 0,
    public x: number = 400,
    public y: number = 300,
    public isSpectator: boolean = false,
    public isAlive: boolean = true
  ) {}
}
