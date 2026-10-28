# CorrigeFácil — testes de segurança e acesso

Data: 27/10/2026. Ambiente: servidor local, http://127.0.0.1:5173.

## Resultado

25/25 cenários automatizados de segurança aprovados. As suítes existentes de integração e equipe e a verificação TypeScript também passaram. Foram usadas contas e registros fictícios; os testes não chamaram a API paga de IA.

## Cobertura

- Acesso anônimo negado a dados, equipe e arquivos; sessão forjada recusada.
- Cookie HttpOnly/SameSite e resposta de autenticação sem cache.
- Mutações com origem ausente ou externa bloqueadas.
- Convite vinculado ao e-mail e protegido contra reutilização.
- Professor impedido de gerenciar equipe ou criar turma forjando papel de coordenador.
- Professor sem atribuições não recebe registros; outra organização não recebe dados.
- Coordenação não pode atribuir turmas a professor de outra equipe.
- Arquivo com conteúdo incompatível com MIME rejeitado.
- Upload bloqueado em turma não atribuída ou fora da avaliação.
- Arquivo privado inacessível a outra organização; retirada de turma revoga acesso imediatamente.
- Suspensão bloqueia e revoga sessões; reativação exige novo login.
- Recuperação de conta suspensa é negada sem consumir o código.
- Recuperação bem-sucedida e logout invalidam sessões anteriores (inclui suíte de equipe).

## Correções aplicadas

1. Upload agora verifica se a turma pertence à avaliação. Antes, as permissões de turma e avaliação eram verificadas separadamente.
2. Recuperação verifica suspensão antes de alterar senha e código. Antes, a requisição falhava após consumir o código.
3. Suspensão remove as sessões existentes na mesma operação de banco que altera o acesso. A reativação não restaura sessões antigas.

## Reproduzir

Com dependências instaladas, migrações locais aplicadas e servidor de desenvolvimento ativo, executar na pasta do projeto:

```text
node tests/security.mjs
node tests/team.mjs
node tests/integration.mjs
npx tsc --noEmit
```

A suíte de segurança usa somente localhost e grava resultados sem credenciais em `.sites-runtime/security-results.json`. Cria dados fictícios persistentes no banco local. Execuções repetidas podem atingir o limite de autenticação; nesse caso, aguardar a janela de 15 minutos. Não desabilitar a proteção para obter aprovação.

## Limites e pendências

Esta verificação é uma bateria de regressão local, não uma auditoria completa ou garantia de segurança. Não valida HTTPS/cookie Secure em produção, infraestrutura hospedada, dependências vulneráveis, carga, expiração temporal de sessões/convites, concorrência de atribuições ou toda a proteção contra força bruta.

O cadastro ainda não verifica posse do e-mail. Convites verificam correspondência do endereço cadastrado, mas confirmação de e-mail é necessária antes de disponibilizar o sistema a escolas reais. Também é necessário revisar autorização de consumo da chave de IA entre contas cadastradas, além dos limites existentes. Esses pontos não foram resolvidos por esta suíte.

As alterações estão no código local e no pacote atualizado; não foram publicadas nesta etapa.
