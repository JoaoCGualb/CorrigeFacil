# CorrigeFácil

Plataforma para organizar provas, simulados e correções por turma. A coordenação cadastra avaliações e gabaritos, convida professores e acompanha as correções. Professores registram respostas, enviam fotos/PDFs e confirmam as notas das turmas atribuídas.

**Estado:** versão em desenvolvimento, validada localmente. O repositório contém código e migrações, sem banco preenchido, usuários, uploads, chaves de API ou credenciais da hospedagem.

## Documentação

- [Guia simples de uso](docs/GUIA-DE-USO.md)
- [Instalação e execução local](docs/INSTALACAO.md)
- [Arquitetura, banco e API](docs/ARQUITETURA.md)
- [Segurança e preparação para produção](SECURITY.md)
- [Testes de segurança realizados](docs/seguranca-testes.md)
- [Medições de desempenho e índices](docs/desempenho.md)

## Funcionalidades

- Cadastro, login e recuperação por código secreto.
- Turmas e importação de alunos por CSV.
- Avaliações objetivas e dissertativas, com gabarito e critérios.
- Convites de professores, vínculos com turmas e suspensão de acesso.
- Correção objetiva automática; notas dissertativas manuais ou sugeridas pela IA.
- Anexos privados em JPG, PNG, WebP e PDF.
- Dashboard por avaliação/turma, atualização periódica e exportação CSV.
- API paginada de resultados por aluno com índice B-tree.

## Começar

Requer Node.js 24, npm e acesso ao registro de pacotes. Python 3 é opcional para o benchmark.

```sh
npm ci
npm run db:local
npm run dev -- --hostname 127.0.0.1
```

Abra `http://127.0.0.1:5173` e crie sua conta. `db:local` aplica migrações somente ao banco local, sem senha ou login Cloudflare. Leia [instalação](docs/INSTALACAO.md) antes de utilizar um banco preexistente.

Para IA, copie `.env.example` para `.env.local` e configure a chave no seu computador. A correção manual funciona sem chave. Uma conta ChatGPT não substitui a cobrança da API.

## Stack

TypeScript, React 19, Vinext/Vite, Cloudflare Workers, D1/SQLite, Drizzle, R2 e OpenAI Responses API. A autenticação da aplicação é própria; não exige login no ChatGPT. Os adaptadores de Sites presentes no código pertencem à infraestrutura do starter.

## Limitações importantes

- Sem login Google, confirmação de e-mail ou envio automático de convites.
- Vínculo professor–turma; ainda não existe atribuição individual por avaliação/turma/professor.
- Dashboard ainda carrega os registros da equipe; a API paginada não foi integrada à interface.
- Alunos e questões ficam em JSON, sem tabelas próprias. Não há histórico imutável completo de auditoria.
- Indicadores por professor representam suas turmas, não necessariamente sua produção individual.
- Verificação de e-mail, controle de consumo da IA entre equipes e testes de produção precisam ser concluídos antes do uso com dados reais.
- Sem cálculo oficial de TRI do ENEM.

## Validação

```sh
npx tsc --noEmit
npm run build
```

Com o servidor local ativo:

```sh
node tests/integration.mjs
node tests/team.mjs
node tests/security.mjs
```

Os testes criam somente contas fictícias, mas persistem dados no banco local. Use ambiente de desenvolvimento dedicado. A IA paga não é chamada por padrão. Para desempenho: `python tests/performance.py`, com pelo menos 1,5 GB livres.
