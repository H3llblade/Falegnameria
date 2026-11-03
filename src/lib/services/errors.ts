/** Errore di dominio con messaggio mostrabile all'utente */
export class DomainError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}
