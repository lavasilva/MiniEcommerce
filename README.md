# Mini E-commerce Distribuído

Sistema de e-commerce mínimo construído sobre uma arquitetura de microsserviços, desenvolvido como projeto acadêmico para a disciplina de Fundamentos de Computação Concorrente, Paralela e Distribuída.

O sistema é composto por quatro serviços independentes que se comunicam via HTTP/REST, com replicação de dados, detecção de falhas por heartbeat e autenticação via JWT.

## Estrutura

```
ecommerce/
├── gateway/          → API Gateway (porta 3000) — proxy reverso, heartbeat e dashboard
├── users/            → Serviço de Usuários (porta 5001) — registro, login e JWT
├── products/         → Serviço de Produtos (porta 5002 + réplica 5012)
├── orders/           → Serviço de Pedidos (porta 5003)
├── docker-compose.yml
├── README_execucao.md  → instruções para rodar o projeto
└── Relatório.pdf       → decisões técnicas, estratégias e limitações
```

## Documentação

- **Como executar:** veja [README_execucao.md](./README_execucao.md)
- **Decisões técnicas e arquitetura:** veja o [Relatório.pdf](./Relatório.pdf)