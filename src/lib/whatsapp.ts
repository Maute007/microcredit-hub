export function whatsappReminderUrl(
  phone: string,
  clientName: string,
  amountMZN: number,
  dueDateLabel: string,
  institutionName: string
): string {
  const formatted = new Intl.NumberFormat("pt-MZ", { style: "currency", currency: "MZN" }).format(amountMZN);
  const text = `Olá ${clientName}, a sua prestação de ${formatted} vence em ${dueDateLabel}. Por favor efectue o pagamento. Obrigado — ${institutionName}.`;
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
