/** L'utente autenticato che SessionAuthGuard mette in `request.user`. */
export interface AuthUser {
  publicId: string;
  nickName: string;
  email: string;
}
