# Mini E-commerce Distribuído — Instruções de Execução

## Pré-requisitos

- Node.js 18 ou superior
- npm

---

## Instalação

Abra **5 terminais separados** (um para cada serviço + réplica de produtos).

Em cada pasta, instale as dependências:

```bash
cd gateway   && npm install
cd users     && npm install
cd products  && npm install
cd orders    && npm install
```

Crie o arquivo `.env` em cada pasta copiando o `.env.example`:

```bash
cp .env.example .env
```

Edite cada `.env` e defina a mesma `JWT_SECRET` em todos, por exemplo:

```
JWT_SECRET=minha_chave_super_secreta_123
```

---

## Execução

Inicie cada serviço em um terminal separado, **nesta ordem**:

**Terminal 1 — Serviço de Usuários**
```bash
cd users
node index.js
# deve exibir: [users] running on port 5001
```

**Terminal 2 — Serviço de Produtos (primário)**
```bash
cd products
node index.js
# deve exibir: [products] running on port 5002
```

**Terminal 3 — Réplica de Produtos**

Linux/Mac:
```bash
cd products
PORT=5012 REPLICA=true REPLICA_URL=http://localhost:5012 node index.js
```

Windows (PowerShell):
```powershell
cd products
$env:PORT="5012"; $env:REPLICA="true"; $env:REPLICA_URL="http://localhost:5012"; node index.js
# deve exibir: [products-replica] running on port 5012
```

**Terminal 4 — Serviço de Pedidos**
```bash
cd orders
node index.js
# deve exibir: [orders] running on port 5003
```

**Terminal 5 — API Gateway**
```bash
cd gateway
node index.js
# deve exibir: [gateway] running on port 3000
```
---

## Execução com Docker Compose 

Se tiver o Docker instalado, é possível subir toda a infraestrutura com um único comando, sem precisar abrir 5 terminais nem instalar dependências manualmente.

### 1. Crie o arquivo `.env` na raiz do projeto

```bash
cp .env.example .env
```

Edite o `.env` e defina a chave secreta:

```
JWT_SECRET=minha_chave_super_secreta_123
```

### 2. Suba todos os serviços

```bash
docker compose up --build
```

Todos os serviços sobem automaticamente na ordem correta. O dashboard fica disponível em `http://localhost:3000/dashboard.html` assim que o gateway estiver pronto.

### 3. Para derrubar tudo

```bash
docker compose down
```

### Testando com Docker

Os mesmos comandos PowerShell da seção anterior funcionam normalmente — a única diferença é que você não precisa dos 5 terminais. Use um terminal separado só para rodar os comandos `curl`.

Para simular a queda de um serviço e testar o heartbeat:

```bash
docker stop ecommerce-orders-1
```

Aguarde 15 segundos e observe o `FAILURE` nos logs do gateway:

```bash
docker logs ecommerce-gateway-1 --follow
```

Para restaurar:

```bash
docker start ecommerce-orders-1
```

Aguarde 10 segundos e observe o `RECOVERY` nos logs.

---

## Dashboard de Monitoramento

Com o gateway rodando, acesse no navegador:

```
http://localhost:3000/dashboard.html
```

O dashboard exibe em tempo real o status de todos os serviços, log de heartbeat e permite buscar pedidos de um usuário.

---

## Testando o Sistema (passo a passo)

Os comandos abaixo usam **variáveis do PowerShell** para evitar erros de cópia de token. Execute no PowerShell em qualquer pasta.

### 1. Criar usuário admin

```powershell
curl -s -X POST http://localhost:3000/users/register -H "Content-Type: application/json" -d '{"name": "Admin", "email": "admin@email.com", "password": "admin123", "role": "admin"}'
```

### 2. Login do admin — salvar token em variável

```powershell
$tokenAdmin = (curl -s -X POST http://localhost:3000/users/login -H "Content-Type: application/json" -d '{"email": "admin@email.com", "password": "admin123"}' | ConvertFrom-Json).token
```

Confirme que salvou:
```powershell
echo $tokenAdmin
```

### 3. Criar um produto (requer token de admin)

```powershell
$produto = curl -s -X POST http://localhost:3000/products -H "Content-Type: application/json" -H "Authorization: Bearer $tokenAdmin" -d '{"name": "Notebook Pro", "description": "Notebook de alto desempenho", "price": 4500.00, "stock": 10}' | ConvertFrom-Json
$productId = $produto.id
echo $productId
```

### 4. Verificar replicação (produto aparece nos dois nós)

```powershell
curl -s http://localhost:5002/products
curl -s http://localhost:5012/products
```

Ambos devem retornar o Notebook Pro.

### 5. Criar usuário comum

```powershell
curl -s -X POST http://localhost:3000/users/register -H "Content-Type: application/json" -d '{"name": "Maria", "email": "maria@email.com", "password": "senha123"}'
```

### 6. Login da Maria — salvar token e userId em variáveis

```powershell
$tokenMaria = (curl -s -X POST http://localhost:3000/users/login -H "Content-Type: application/json" -d '{"email": "maria@email.com", "password": "senha123"}' | ConvertFrom-Json).token
```

```powershell
$userId = (curl -s -X POST http://localhost:3000/orders -H "Content-Type: application/json" -H "Authorization: Bearer $tokenMaria" -d "{`"productId`": `"$productId`", `"quantity`": 1}" | ConvertFrom-Json).userId
echo $userId
```

### 7. Criar mais um pedido

```powershell
curl -s -X POST http://localhost:3000/orders -H "Content-Type: application/json" -H "Authorization: Bearer $tokenMaria" -d "{`"productId`": `"$productId`", `"quantity`": 3}"
```

### 8. Ver pedidos no dashboard

Acesse `http://localhost:3000/dashboard.html`, cole o valor de `$userId` no campo **userId** e o valor de `$tokenMaria` no campo **JWT token** e clique em **buscar pedidos**.

Ou via curl:
```powershell
curl -s http://localhost:3000/orders/$userId -H "Authorization: Bearer $tokenMaria"
```

### 9. Testar segurança — usuário comum tentando criar produto

```powershell
curl -s -X POST http://localhost:3000/products -H "Content-Type: application/json" -H "Authorization: Bearer $tokenMaria" -d '{"name": "Produto Proibido", "price": 99}'
```

Deve retornar **403 Forbidden**.

### 10. Testar requisição sem token

```powershell
curl -s http://localhost:3000/users/qualquer-id
```

Deve retornar **401 Unauthorized**.

---

## Testando Tolerância a Falhas (Heartbeat)

### Simular queda de um serviço

1. Feche o **Terminal 4** (pedidos) com `Ctrl+C`
2. Aguarde 15 segundos
3. Observe no terminal do gateway a mensagem de `FAILURE`
4. Tente acessar o serviço derrubado:

```powershell
curl -s http://localhost:3000/orders/$userId -H "Authorization: Bearer $tokenMaria"
```

Deve retornar **503 Service Unavailable**.

5. Reinicie o serviço no Terminal 4:
```bash
node index.js
```
6. Aguarde 10 segundos e observe a mensagem de `RECOVERY` no terminal do gateway

Os logs ficam gravados em `gateway/logs/heartbeat.log`.

---

## Estrutura de Portas

| Serviço           | Porta |
|-------------------|-------|
| API Gateway       | 3000  |
| Serviço Usuários  | 5001  |
| Serviço Produtos  | 5002  |
| Réplica Produtos  | 5012  |
| Serviço Pedidos   | 5003  |

---

## Arquivos de Dados

Cada serviço persiste seus dados automaticamente em:

```
users/data/users.json
products/data/products.json
products/data/products-replica.json
orders/data/orders.json
gateway/logs/heartbeat.log
```


---