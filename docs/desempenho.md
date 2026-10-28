# CorrigeFácil — desempenho de buscas com índices

Data: 28/10/2026. Teste real em SQLite local, com dados exclusivamente sintéticos.

## Tempos medidos

Mediana em milissegundos. A busca retorna uma correção por ID de aluno; a varredura calcula a quantidade de correções marcadas como confirmadas lendo o campo JSON de todos os registros.

| Registros | Busca antes | Busca com índice B-tree | Varredura completa após índices |
|---:|---:|---:|---:|
| 100 | 0,512 ms | 0,377 ms | 0,585 ms |
| 1.000 | 1,704 ms | 0,361 ms | 1,798 ms |
| 100.000 | 269,613 ms | 0,352 ms | 278,950 ms |
| 1.000.000 | 2.218,130 ms | 0,296 ms | 2.148,278 ms |
| 1.000.000.000 | Não executado | Não executado | Não executado |

Os valores não são tempos de carregamento da página nem estimativas de produção. A pequena diferença entre os tempos indexados não significa que mais registros tornem a busca mais rápida: há variação de cache e execução.

## Método e verificação

- Banco em disco temporário separado do banco da aplicação, com esquema e migrações reais.
- Uma equipe, uma correção por aluno, JSON com resposta escrita sintética; aproximadamente 1,1 KB por registro incluindo estrutura e índices existentes. Não inclui fotos/PDFs.
- Comparação com os índices antigos, não com um banco sem nenhum índice.
- Mesma consulta e parâmetros antes/depois; uma consulta inicial de aquecimento. Busca do mesmo aluno no final da população repetida 7 vezes antes e 101 depois; varredura repetida 7 vezes. Uma conexão, sem concorrência. Esse cenário favorece o cache e não simula acessos aleatórios a disco frio.
- Tempos incluem execução SQL e obtenção dos resultados pelo Python. Excluem rede, autenticação, autorização de professores, IA e renderização.
- `EXPLAIN QUERY PLAN` antes: índice `records_owner_kind` para selecionar a equipe e tipo, seguido de filtro do aluno e ordenação temporária.
- Depois: `SEARCH records USING INDEX records_student_lookup (owner=? AND <expr>=? AND id>?)`.
- Verificadas equivalência dos resultados antes/depois e ausência de dados de outra equipe.
- P95 da busca indexada: 0,573 ms / 0,423 ms / 0,444 ms / 0,586 ms, respectivamente. Amostra pequena, não representa um SLA.
- Em 1 milhão: criação dos dois novos índices levou 5,06 s; banco passou de 1.119.338.496 para 1.175.633.920 bytes (aproximadamente 56,3 MB adicionais). O custo de escrita contínua com índices não foi medido.

A varredura é um agregado simples, não o cálculo completo de notas, versões de gabarito ou todos os gráficos do dashboard.

## O caso de 1 bilhão

Não foram criados 1 bilhão de registros. Uma extrapolação puramente linear da varredura de 1 milhão daria cerca de **35,8 minutos**, e o armazenamento seria da ordem de **1,18 TB**, sem anexos, backups ou espaço temporário. Isso não é uma medição nem uma previsão confiável: memória, disco, concorrência, limites do serviço e outra arquitetura podem alterar completamente o resultado.

Não é correto extrapolar o tempo da busca indexada multiplicando por mil. O índice reduz o trabalho de localizar registros, mas o tempo remoto e a quantidade de resultados retornados continuam relevantes. O projeto atual não foi validado para 1 bilhão de registros.

## Alterações aplicadas

1. Índice parcial B-tree `records_student_lookup`: equipe + ID do aluno extraído do JSON + ID do registro, somente para correções.
2. Índice `records_owner_updated`: equipe + data de atualização, para a ordenação já usada na leitura geral.
3. Verificação de correção duplicada agora consulta o índice único `records_submission_identity` existente.
4. Nova API `GET /api/results?studentId=ID&limit=25&after=CURSOR`, com até 100 resultados por página e permissões aplicadas antes da paginação.
5. Migração aplicada no banco local. Não publicada no ambiente remoto.

O dashboard atual ainda carrega seus dados por `/api/data`; ele não foi convertido para usar a nova API. O ganho medido é da busca direcionada no banco, não uma aceleração automática de todos os relatórios. Busca por nome do aluno também não foi implementada por este índice.

## Testes funcionais

Passaram as suítes de integração e equipe, os 25 cenários de segurança e a verificação TypeScript. A suíte de equipe agora valida também a nova API: paginação sem repetição, isolamento entre equipes, acesso anônimo negado, limite máximo e bloqueio após retirada da turma do professor. Nenhuma chamada paga de IA foi realizada.

## Reprodução e referências

Na pasta do código: `python tests/performance.py`. O teste cria arquivos temporários sob `.sites-runtime`, requer espaço livre e grava as métricas sem credenciais em `.sites-runtime/performance-results.json`. Consultas e distribuição dos dados estão no próprio script.

Índices B-tree são a estrutura apropriada do SQLite para essas consultas; não foi criado um algoritmo manual de árvore binária. Referências: [planejamento e buscas indexadas no SQLite](https://www.sqlite.org/queryplanner.html) e [índices sobre expressões](https://www.sqlite.org/expridx.html).
