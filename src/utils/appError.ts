/** Erro esperado de regra de negocio - mensagem segura para repassar direto ao cliente da API. */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}
