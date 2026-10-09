# Aceite formal de risco — Claim Firestore (CA-01-03)

- **Data:** 2026-10-09. **Decisão:** H1 (usuário) — remover o claim Firestore auto-emitido.
- **O que foi removido:** emissão automática de `SEC-CLAIM-FIRESTORE-001` e findings `EOS-DOM-*-FIRESTORE-*` para alvos **sem** claim FIRESTORE ACTIVE declarado em `eos.risk.yml`. O motor (`firestore-security-engine.ts`, `firestore-domain-adapter`) foi preservado e executa quando declarado (CA-01-04).
- **Risco residual aceito:** o `firestore.rules` do próprio EOS (`firebase.json` → regras dos cofres `/users/{userId}/secrets`) segue sem prova causal automatizada; proteção baseia-se na regra deny-by-default (`allow read, write: if false`) e revisão manual.
- **Condição de reversão:** se um teste `@firebase/rules-unit-testing` for criado para o alvo, declarar o claim ACTIVE e a avaliação volta a vigorar.
