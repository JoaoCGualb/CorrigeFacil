# Instalação e operação técnica

## Ambiente local novo

1. Instale Node.js 24 LTS e Git. Python 3 é necessário apenas para o benchmark.
2. Clone o repositório e abra um terminal na pasta que contém `package.json`.
3. Execute `npm ci` para instalar as versões do lockfile.
4. Execute `npm run db:local`. Confirme a aplicação das quatro migrações se o Wrangler perguntar. O comando usa apenas o banco local em `.wrangler/state`.
5. Execute `npm run dev -- --hostname 127.0.0.1`.
6. Abra `http://127.0.0.1:5173` e cadastre uma conta. O banco começa vazio.

O UUID com zeros em `wrangler.local.json` e `vite.config.ts` é deliberadamente fictício para desenvolvimento local. Não é uma credencial. `.openai/hosting.json` contém apenas nomes de bindings, sem vínculo com a hospedagem do autor.

**Banco preexistente:** o ambiente original aplicava SQL manualmente. Não execute este comando cegamente sobre um banco que já tem tabelas sem histórico de migração do Wrangler: pode ocorrer erro de objeto existente. Faça backup e reconcilie as migrações aplicadas antes de reutilizar esse banco. Nunca apague o banco real para resolver esse erro.

## IA opcional

Copie `.env.example` para `.env.local` e preencha `OPENAI_API_KEY` localmente. Reinicie o servidor. Não cole chaves em código, documentação, issues ou commits. Sem chave/créditos, continue com correção manual. O uso de IA envia o conteúdo selecionado ao provedor.

O D1 não utiliza usuário/senha de conexão neste projeto. A API recebe o binding `DB` pelo runtime Cloudflare. R2 usa `BUCKET`. Nenhuma senha de banco precisa ser colocada no repositório.

## Testes

Com o servidor local ativo, execute separadamente e verifique os códigos de saída:

```sh
node tests/integration.mjs
node tests/team.mjs
node tests/security.mjs
```

Esses testes criam contas fictícias e dados persistentes. Os arquivos auxiliares de teste ficam em `.sites-runtime`, ignorado no Git. Execuções repetidas podem atingir o limite de autenticação: aguarde a janela de 15 minutos em vez de desativar a proteção. `TEST_AI=1` no teste de integração habilita uma chamada real e pode gerar custo.

```sh
npx tsc --noEmit
npm run build
python tests/performance.py
```

O benchmark requer aproximadamente 1,5 GB livres, usa SQLite temporário isolado e não toca no D1 remoto. Uma medição de SQL local não representa latência de rede ou capacidade de produção.

## Build e hospedagem

O build produz `dist/server/wrangler.json` e os assets. Esta cópia não inclui configuração de publicação pronta para a conta original. Publicar exige provisionar Workers, D1 e R2 na conta de destino ou configurar um novo projeto Sites.

Antes de publicar:

1. Resolva as pendências em `SECURITY.md`.
2. Crie recursos próprios e configure bindings `DB`/`BUCKET` e identificadores do ambiente de destino. Não use o UUID de desenvolvimento para produção.
3. Aplique as migrações ao banco de destino com backup e revisão do SQL.
4. Configure `OPENAI_API_KEY` como segredo no provedor, quando necessário.
5. Verifique domínio HTTPS, cookies, isolamento entre equipes e acesso privado aos arquivos.

Não existe publicação automática configurada neste repositório. Credenciais de deploy devem ficar no provedor ou em secrets do CI, nunca em arquivos versionados.

## Solução de problemas

- **no such table:** as migrações não foram aplicadas no mesmo diretório de persistência do servidor.
- **porta 5173 ocupada:** encerre a instância de desenvolvimento anterior ou ajuste a porta e os testes explicitamente.
- **IA indisponível:** confirme a configuração local e o saldo do provedor sem imprimir a chave em logs.
- **professor não vê avaliação:** confirme aceite do convite, situação ativa, turma atribuída e turma vinculada à avaliação.
- **conflito de edição:** atualize a página e revise o registro antes de reenviar.
