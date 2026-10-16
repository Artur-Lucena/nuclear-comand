function mensagemOpenCode(error) {
  if (error?.type === "provider.quota" || error?.status === 429) {
    return "Limite de uso do modelo atingido. Aguarde a liberação ou escolha outro modelo no menu COMANDANTE.";
  }
  if (typeof error === "string") return error;
  if (typeof error?.message === "string" && error.message) return error.message;
  if (typeof error?.error?.message === "string" && error.error.message) return error.error.message;
  if (typeof error?.type === "string" && error.type) return `Erro do OpenCode: ${error.type}`;
  return "Erro desconhecido do OpenCode.";
}

module.exports = { mensagemOpenCode };
