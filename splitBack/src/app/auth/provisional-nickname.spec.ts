import { nicknameError } from '../user/nickname';
import { nicknameFromName } from './provisional-nickname';

describe('nicknameFromName', () => {
  it('dal nome di Google/Apple a un nickname valido', () => {
    expect(nicknameFromName('Mario Rossi')).toBe('Mario.Rossi');
    expect(nicknameFromName('José María Pérez')).toBe('Jose.Maria.Perez');
    expect(nicknameFromName('  Zio_Paperone!! ')).toBe('Zio.Paperone');
  });

  it('niente separatori ai lati o doppi, e al massimo 20 caratteri', () => {
    expect(nicknameFromName('..admin--')).toBe('admin');
    expect(nicknameFromName('Anna -- Maria')).toBe('Anna.Maria');
    const long = nicknameFromName('Bartolomeo Massimiliano Rossi');
    expect(long).not.toBeNull();
    expect(nicknameError(long as string)).toBeNull();
  });

  it('null quando non ne esce un nickname valido', () => {
    expect(nicknameFromName('')).toBeNull();
    expect(nicknameFromName('Ugo')).toBeNull();
    expect(nicknameFromName('李小龍')).toBeNull();
    expect(nicknameFromName('..ad')).toBeNull();
  });
});
