# Fase 2A — Parcelamentos e Recorrências

Escopo desta subfase, mantendo a identidade visual atual e sem quebrar o que já existe.

## 1. Banco de dados (nova migration)

Novas colunas em `transactions`:
- `installment_group_id` (uuid) — agrupa todas as parcelas de uma mesma compra.
- `installment_number` (int) — posição da parcela (1, 2, 3…).
- `installment_total` (int) — total de parcelas.
- `status` (enum `pendente` | `paga` | `cancelada`) — padrão `pendente` para compras futuras; despesas à vista já entram como `paga`.
- `due_date` (date) — data de vencimento da parcela / fatura correspondente.
- `invoice_month` (date, dia 1 do mês) — fatura na qual a parcela cai.
- `recurrence_id` (uuid, FK para `recurrences`).

Nova tabela `recurrences` (contas recorrentes):
- Dono, escopo (individual/compartilhado).
- Tipo (`receita` | `despesa`), valor, descrição, categoria, conta ou cartão.
- Frequência (`mensal` | `semanal` | `anual`), `interval_count`, `start_date`, `end_date` (opcional).
- `next_run_at`, `status` (`ativa` | `pausada` | `encerrada`).

Nova tabela `installment_purchases` (compra parcelada "mestre"):
- Cartão, valor total, número de parcelas, descrição, categoria, escopo, `installment_group_id`.
- Facilita edições em massa das parcelas.

Todas com **GRANT + RLS por dono/escopo**, seguindo o padrão do projeto.

## 2. Funções SQL (regras de negócio)

- `create_installment_purchase(...)`: gera N transações-parcela, calcula vencimento em cada fatura (respeitando `closing_day` e `due_day` do cartão), amarra ao `installment_group_id`, reserva o **limite total imediatamente** (comportamento real do cartão).
- `update_installment_group(mode: 'este' | 'este_e_proximos' | 'todos', changes...)`: aplica edições em massa.
- `delete_installment_group(mode: 'este' | 'este_e_proximos' | 'todos', current_number)`: exclusão em massa, com **liberação proporcional do limite**.
- `generate_recurrence_occurrences()`: gera transações do mês para recorrências ativas cuja `next_run_at` já chegou (executada sob demanda no login; agendamento por cron fica para uma subfase futura sem alterar o contrato).
- Trigger em `transactions`: quando `status` muda de `pendente` → `paga` em despesa de cartão, **libera o limite proporcional da parcela**.
- Ajuste do trigger existente `apply_transaction_balance` para não reduzir saldo de conta duas vezes em parcelas (parcelas não movimentam conta, só cartão).

## 3. Backend/UX de parcelamentos (frontend)

Na tela **Movimentações**:
- No formulário de despesa com cartão, novo bloco "Compra parcelada" com: nº de parcelas (1–24), 1ª parcela (data), preview das parcelas ("12x de R$ 200,00 — 1ª em nov/26").
- Ao salvar, chama `create_installment_purchase` (via server function).
- Cada parcela aparece na lista com badge "3/12" e status.

Nova tela **Parcelas / Compras parceladas** (ou seção dentro de Movimentações):
- Agrupa por `installment_group_id`, mostra progresso (pagas/total), valor total, restante.
- Ações: **Editar** (modal com 3 opções: apenas esta / esta e próximas / todas) e **Excluir** (mesmas 3 opções).
- Marcar parcela como paga (dispara liberação de limite).

## 4. Backend/UX de recorrências

Nova rota **`/recorrentes`** (adicionada à sidebar):
- Lista de contas recorrentes com nome, valor, frequência, próxima ocorrência, status.
- Criar/editar/pausar/excluir.
- Ao entrar na aplicação, dispara `generate_recurrence_occurrences()` (idempotente) para lançar automaticamente as ocorrências devidas.

## 5. Dashboard e cartões

- Dashboard: passa a considerar **apenas parcelas do período selecionado** (não a compra total). Já é o comportamento natural filtrando por `occurred_at`/`invoice_month`.
- Página de **Cartões**: exibe valor da fatura atual, próxima fatura e total comprometido em faturas futuras (soma de parcelas `pendente` do cartão agrupadas por `invoice_month`).

## 6. Arquitetura reutilizável

- `src/lib/installments.ts` — helpers puros: `computeInvoiceMonth(purchaseDate, closingDay, dueDay)`, `buildInstallmentsPreview(...)`.
- `src/lib/recurrence.ts` — cálculo de próxima ocorrência.
- `src/lib/*.functions.ts` — server functions tipadas para operações sensíveis (criar/editar/excluir compra parcelada, gerar recorrências).
- Componentes reutilizáveis: `<InstallmentsPreview />`, `<InstallmentEditDialog />` (3 opções), `<RecurrenceForm />`.
- Ícones e textos 100% pt-BR; datas via `Intl.DateTimeFormat("pt-BR")`; moeda via helper `formatCurrency` já existente.

## 7. O que NÃO entra nesta subfase

- Alertas de vencimento/fechamento, tags avançadas, filtros/pesquisa → Fase 2B.
- Exportação PDF/Excel/CSV → Fase 2C.
- Cron real para recorrências: por ora, geração idempotente no login. Podemos migrar para `pg_cron` depois sem quebrar contrato.

## Ordem de execução

1. Migration (schema + funções + triggers).
2. Helpers/lib e server functions.
3. UI de parcelamentos (formulário + lista agrupada + edição/exclusão em massa).
4. UI de recorrências (nova rota + item na sidebar).
5. Ajustes no dashboard e página de cartões.
6. Revisão final de textos pt-BR.

Ao final, aguardo sua aprovação antes de iniciar a Fase 2B.
