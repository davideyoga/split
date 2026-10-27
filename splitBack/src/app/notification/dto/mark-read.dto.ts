import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

// Le notifiche che il frontend ha mostrato: si segnano come lette solo quelle,
// non "tutte", cosi' una arrivata nel frattempo resta da leggere.
export class MarkReadDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  publicIds!: string[];
}
