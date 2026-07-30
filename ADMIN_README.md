# NEW GEN — Sistema Administrativo Multi-Marca

Stack mantida: HTML + CSS + JavaScript puro (ES Modules) no frontend,
Google Apps Script + Google Sheets como backend, Firebase Auth para identidade.

## Princípio central

O frontend **nunca** declara a marca. Ele envia apenas o `idToken` do Firebase.
O Apps Script resolve `uid -> Admins -> marca_id` a cada requisição e aplica o
escopo. Um payload malicioso com `marca_id` é removido no cliente (`AdminApi`)
e ignorado no servidor (`Guard.sanitize` / `Guard.applyScope`).

## Estrutura

```
admin.html                 shell do painel
admin.css                  estilos (herda os tokens de styles.css)
pages/admin/*.html         fragmentos de tela
js/admin/AdminApi.js       cliente único do Apps Script
js/admin/AdminSession.js   sessão resolvida no servidor
js/admin/Permissions.js    permissões orientadas a dados (sem if por cargo)
js/admin/AdminGuard.js     proteção de rota (UX)
js/admin/AdminApp.js       bootstrap + roteamento por hash
js/admin/views.js          controladores de tela
js/repositories/*.js       repositórios (persistência trocável)
apps-script/*.gs           backend
```

## Abas da planilha

| Aba | Colunas |
| --- | --- |
| Admins | admin_id, firebase_uid, nome, email, marca_id, role, status, criado_em, ultimo_acesso, criado_por, observacoes, meta_json |
| Marcas | marca_id, nome, status, criado_em, meta_json |
| Permissoes | role, permissao, permitido |
| AuditLog | log_id, data_hora, admin_id, marca_id, acao, alvo, resultado, detalhe |
| Personagens | (colunas atuais) + **marca_id** |

## Deploy (uma vez)

1. Abra a planilha → Extensões → Apps Script e cole todos os arquivos de `apps-script/`.
2. Em **Configurações do projeto → Propriedades do script**, defina:
   - `FIREBASE_PROJECT_ID` — id do projeto Firebase
   - `FIREBASE_API_KEY` *(opcional)* — Web API Key; permite criar a conta Firebase
     junto com o admin. Sem ela, o admin é pré-cadastrado por e-mail e o `firebase_uid`
     é vinculado automaticamente no primeiro login.
   - `SPREADSHEET_ID` *(opcional)* — se o script não estiver vinculado à planilha.
3. Execute `setup_completo()` (cria abas, permissões padrão, marca de legado e backfill).
4. Edite e execute `setup_4_primeiroSuperAdmin()`.
5. Implantar → Nova implantação → App da Web → Executar como **Eu**, acesso **Qualquer pessoa**.
6. Cole a URL `/exec` em `ADMIN_ENDPOINT` (`js/admin/AdminApi.js`).

## Permissões

São **linhas da planilha**, não código. Criar um cargo novo = adicionar linhas
na aba `Permissoes`. `*` concede tudo. Curinga por domínio: `personagem.*`.

Padrão semeado: `super_admin` (`*`), `admin`, `moderador`, `editor`.

## Regras invioláveis implementadas

- Um admin pertence a **uma** marca; `marca_id` nunca é editável por nenhuma rota.
- Contas individuais: `admin.criar` recusa e-mail duplicado; sem login compartilhado.
- Novo admin herda a marca de quem o criou.
- Conceder cargo diferente do próprio exige `admin.definir_role`.
- Ninguém desativa a própria conta (`SELF_LOCKOUT`).
- Toda leitura passa por `scopeFilter`; toda escrita por `applyScope`/`assertScope`.
- Tentativa cross-brand é registrada no `AuditLog` como `DENIED`.

## Escalabilidade

Adicionar uma nova entidade com escopo de marca:
1. Criar a aba e incluir o nome em `CONFIG.ABAS_COM_ESCOPO`.
2. Criar o serviço `.gs` usando `Guard.scopeFilter` / `Guard.applyScope`.
3. Registrar as ações em `ROUTES` (`Router.gs`).
4. Criar o repositório em `js/repositories/` e a view em `js/admin/views.js`.

Nenhuma alteração no núcleo de autenticação, escopo ou permissões é necessária.

## Compatibilidade

A ação legada `saveUser` continua funcionando sem sessão administrativa
(`LegacyService.gs`), então o app público atual não sofre nenhuma alteração
de comportamento.

## Migração futura

Trocar Sheets por um banco real exige reescrever apenas `Repo.gs` (servidor) —
serviços, guardas e todo o frontend permanecem intactos, porque a interface dos
repositórios não muda.
