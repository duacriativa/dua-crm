/**
 * Erro do Business Discovery que significa "esse @ não existe ou não está visível" (conta pessoal
 * ou privada), e não uma falha da consulta. A Meta traduz o texto conforme o idioma da conta:
 * em produção ele vem em português. Por isso olha primeiro o código, que não muda.
 */
export function isProfileNotFoundError(error: any): boolean {
  if (error?.error_subcode === 2207013) return true;
  const msg = `${error?.error_user_msg ?? ''} ${error?.message ?? ''}`;
  return /cannot be found|cannot find|invalid user id|not.*business|não foi possível encontrar o usuário/i.test(msg);
}
