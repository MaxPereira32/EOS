# Perfil Arquitetural — Laravel ActiveRecord (MVC)

* **Código de Perfil**: `PROF-LARAVEL-AR`
* **Paradigma**: Model-View-Controller clássico com persistência via Active Record (Eloquent ORM).

---

## 1. Características e Filosofia
A arquitetura é focada em velocidade de entrega rápida e facilidade de manutenção por coesão de framework. O banco de dados e as entidades de negócio são acoplados por design na classe Model.

---

## 2. Limitações Inerentes (Aceitas sem Penalidade)
* **Modelos Acoplados à Infraestrutura**: O Model (ex: `App\Produto`) conhece a estrutura da tabela MySQL e estende diretamente `Illuminate\Database\Eloquent\Model`. **Penalidade de acoplamento de persistência = 0**.
* **Consultas Simples nos Controladores**: Operações diretas de leitura e deleção simples por chave primária (ex: `Produto::find($id)` ou `$produto->delete()`) são aceitas nos controladores. **Penalidade de vazamento de persistência = 0**.

---

## 3. Práticas Proibidas (Acoplamentos Acidentais Penalizados)
* **SQL Cru inline**: O uso de `DB::select` ou `DB::raw` com queries complexas de negócio diretamente nos Controllers.
* **Composições de Joins Complexos nos Controladores**: Montagem de queries encadeadas com múltiplos joins (`leftJoin()`, `groupBy()`) misturados com lógica de renderização de telas nos Controllers.
* **Regras de Validação Manuais**: Realizar lógica manual de sanitização de strings no controlador em vez de usar classes dedicadas `Request` ou `FormRequest`.

---

## 4. Recomendações Proporcionais
* **Nível 1 (Menor esforço)**: Mover queries encadeadas e de agregação complexa para um **Service de Consulta** dedicado (ex: `app/Services/ProdutoConsultaService.php`) ou declarar `scopes` no próprio Model.
* **Nível 2**: Não recomendar padrões complexos (Repository ou Domain Driven Design) a menos que o projeto possua alta complexidade, regras de negócio multi-banco ou requisitos estritos de migração.
