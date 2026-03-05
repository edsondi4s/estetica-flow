-- Adicionar coluna de foto para profissionais
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Adicionar coluna de observações/notas para clientes (útil para o detalhamento)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes TEXT;
