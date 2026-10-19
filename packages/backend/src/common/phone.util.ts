// Telefones são guardados como "+<DDI><DDD><número>" (ex.: +5511999999999).

/** Só dígitos, com DDI 55 quando vier um número brasileiro sem ele (10 ou 11 dígitos). */
export function toBrDigits(phone: string) {
  let digits = (phone || '').replace(/\D/g, '');
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) digits = '55' + digits;
  return digits;
}

/** Formato salvo no banco: "+" + dígitos normalizados. */
export function normalizePhone(phone: string) {
  const digits = toBrDigits(phone);
  return digits ? `+${digits}` : null;
}

/** Variantes do mesmo número no Brasil: com e sem o nono dígito. */
export function phoneVariants(phone: string) {
  const raw = toBrDigits(phone);
  if (!raw) return [];
  const variants = [`+${raw}`];
  if (raw.startsWith('55') && raw.length === 12) variants.push(`+${raw.slice(0, 4)}9${raw.slice(4)}`);
  if (raw.startsWith('55') && raw.length === 13) variants.push(`+${raw.slice(0, 4)}${raw.slice(5)}`);
  return variants;
}

/** Dígitos para o cadastro vindo do formulário do site: tira o 0 inicial e põe DDI 55 em número BR. */
export function formatPhone(phone: string): string {
  if (!phone) return '';
  if (phone.startsWith('lid:')) return phone;
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0') && cleaned.length > 10) cleaned = cleaned.substring(1);
  if ((cleaned.length === 10 || cleaned.length === 11) && !cleaned.startsWith('55')) cleaned = '55' + cleaned;
  return cleaned;
}
