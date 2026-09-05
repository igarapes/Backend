## Descrição
<!-- Descreva de forma clara e concisa o que este PR faz. Qual problema ele resolve? -->
[Substitua este texto por um breve resumo das alterações...]

##  Link para a Tarefa / Epic
<!-- Ex: #123 ou link do Jira/Trello -->
- **Epic/Issue:** 
 
## Tipo de alteração
<!-- Marque as opções que se aplicam a este PR com um [x] -->
- [ ] Nova funcionalidade (Feature)
- [ ] Correção de bug (Bugfix)
- [ ] Refatoração (Alterações que não mudam a funcionalidade final)
- [ ] Testes (Adição ou refatoração de testes)
- [ ] Documentação
- [ ] Segurança (Melhorias de acesso, auditoria, etc.)

## Checklist de Engenharia e Segurança
<!-- Valide se a sua entrega cumpre os requisitos arquiteturais -->
- [ ] O código segue a Clean Architecture (separação de responsabilidades).
- [ ] Nenhuma informação sensível (senhas, tokens) está sendo "vazada" em logs ou mensagens de erro.
- [ ] Os dados de entrada estão sendo validados (Bounds Checking / Zod).
- [ ] Ações críticas foram registradas no sistema de Auditoria (Não Repúdio).

## Como isso foi testado?
<!-- Descreva os passos para testar ou os testes automatizados criados -->
- [ ] Testes de Integração criados/atualizados.
- [ ] Os testes rodam em isolamento de banco de dados (estado não vaza).
- [ ] Todos os testes locais passaram (`npm run test`).
- [ ] O build foi executado com sucesso (`npm run build`).

## Evidências (Opcional)
<!-- Adicione prints do terminal, do banco de dados (ex: logs salvos) ou do Swagger -->