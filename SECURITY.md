# Segurança e dados sensíveis

Este repositório é uma cópia limpa do código, sem histórico do ambiente original. Não inclui `.env.local`, tokens, bancos SQLite, dados de alunos, sessões, anexos, logs, configurações locais de contas ou identificador do projeto hospedado.

`.env.example` contém somente um campo vazio. O `.gitignore` exclui ambientes, chaves, bancos, builds e estado local. Não use `git add -f` para contornar essas exclusões. Nenhuma varredura automatizada garante detectar todo segredo; revise o diff antes de publicar.

## Proteções existentes

- Senhas com PBKDF2, SHA-256, salt individual e 100.000 iterações.
- Tokens de sessão e recuperação armazenados como hash.
- Cookies HttpOnly/SameSite; Secure e prefixo __Host- em HTTPS.
- Verificação de origem nas mutações e consultas SQL parametrizadas.
- Escopo de equipe e autorização por turma no servidor.
- Revogação de sessões ao suspender professor e ao recuperar conta.
- Limites de autenticação, upload e chamadas de IA.
- Arquivos privados, validação básica de tipo/assinatura e cabeçalhos restritivos.

## Pendências antes de produção

1. Confirmar a posse do e-mail antes de autorizar convites.
2. Definir quais equipes podem consumir a chave de IA e estabelecer orçamento/monitoramento.
3. Revisar vazamento de detalhes em mensagens de erro e concorrência de atribuições.
4. Validar HTTPS, expiração, força bruta, backups e recuperação de desastre no ambiente remoto.
5. Planejar retenção, exclusão e tratamento dos dados de alunos; a análise por IA transmite anexos à OpenAI.
6. Definir auditoria e normalização dos dados escolares para uso institucional.

Os testes locais não constituem auditoria completa. Não cadastre alunos reais antes de resolver essas pendências e definir as responsabilidades operacionais.

## Comunicação de falhas

Contate o mantenedor por canal privado. Não abra issue pública contendo credenciais, dados pessoais, dumps de banco ou links com tokens de convite. Caso uma chave vaze, revogue-a no provedor: apagar o arquivo do Git não invalida a credencial.
