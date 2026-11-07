export interface User{
  publicId: string;
  nickName: string;
  email?: string;
  // Solo per l'utente loggato: appena registrato, nickname ancora provvisorio
  // (l'authGuard lo manda su /welcome).
  needsName?: boolean;
}
