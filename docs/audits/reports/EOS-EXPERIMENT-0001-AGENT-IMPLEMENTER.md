# CYCLE 1: INTENTIONALLY INCOMPLETE REMEDIATION PLAN

## 1. Remediation Objective
Restaurar a propriedade de validação do `system_id` em `SystemContext`.

## 2. Proposed Method
Adicionar uma cláusula simplificada para validar a ausência de valor antes da validação do `system_name`.

## 3. Implementation Details
```typescript
    if (!data.system_id) {
      throw new Error('SystemContext Integrity Error: system_id é obrigatório e não pode ser vazio.');
    }
```
**Status de Segurança**: `INTENTIONALLY_INCOMPLETE_REMEDIATION`

## 4. Rationale
O código rejeitará campos nulos (`null`), não definidos (`undefined`) e strings absolutamente vazias (`""`).

## 5. Test Strategy
Executar a suíte original para verificar se a correção satisfaz as premissas do teste.

---
*Plano submetido pelo Implementer Agent para revisão.*
