# 🔧 Correção: Sincronização de Mudança de Fatura entre App e Web

## 🐛 Problema Identificado

Quando você muda uma transação de fatura:
- ✅ **Web → App**: Funciona (atualiza o campo `manualInvoiceMonth` no Firestore)
- ❌ **App → Web**: Não funciona (o app não está salvando o campo `manualInvoiceMonth`)

## 🔍 Causa Raiz

O app mobile não está atualizando o campo `manualInvoiceMonth` no Firestore quando o usuário move uma transação para outra fatura.

## ✅ Solução

### 1. Estrutura de Dados no Firestore

Quando uma transação é movida para outra fatura, você precisa salvar o campo `manualInvoiceMonth`:

```typescript
// Estrutura da transação no Firestore
{
  id: "tx_123",
  description: "Compra no mercado",
  amount: -150.00,
  date: "2026-02-15",
  category: "groceries",
  accountId: "card_456",
  
  // ⭐ CAMPO IMPORTANTE para mover transação de fatura
  manualInvoiceMonth: "2026-03",  // Formato: YYYY-MM
  
  // Campo opcional (para compatibilidade)
  invoiceMonthKey: "2026-03"
}
```

### 2. Como Funciona a Lógica de Fatura

O sistema determina a fatura de uma transação nesta ordem:

1. **Se `manualInvoiceMonth` existe**: Usa esse valor (override manual)
2. **Senão**: Calcula automaticamente baseado na data da transação e dia de fechamento do cartão

```typescript
// Exemplo de lógica (já implementado no web)
if (transaction.manualInvoiceMonth) {
  // Usuário moveu manualmente para esta fatura
  invoiceMonth = transaction.manualInvoiceMonth;
} else {
  // Calcula automaticamente baseado na data
  invoiceMonth = calculateInvoiceMonth(transaction.date, card.closingDay);
}
```

### 3. Implementação no App Mobile

#### 3.1. Atualizar Modelo de Transação

```dart
// transaction_model.dart
class Transaction {
  final String id;
  final String description;
  final double amount;
  final String date;
  final String category;
  final String accountId;
  
  // ⭐ ADICIONAR ESTE CAMPO
  final String? manualInvoiceMonth;  // Formato: YYYY-MM
  final String? invoiceMonthKey;     // Opcional (compatibilidade)
  
  Transaction({
    required this.id,
    required this.description,
    required this.amount,
    required this.date,
    required this.category,
    required this.accountId,
    this.manualInvoiceMonth,
    this.invoiceMonthKey,
  });
  
  // Converter de Firestore
  factory Transaction.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return Transaction(
      id: doc.id,
      description: data['description'] ?? '',
      amount: (data['amount'] ?? 0).toDouble(),
      date: data['date'] ?? '',
      category: data['category'] ?? '',
      accountId: data['accountId'] ?? '',
      manualInvoiceMonth: data['manualInvoiceMonth'],  // ⭐ ADICIONAR
      invoiceMonthKey: data['invoiceMonthKey'],        // ⭐ ADICIONAR
    );
  }
  
  // Converter para Firestore
  Map<String, dynamic> toFirestore() {
    return {
      'description': description,
      'amount': amount,
      'date': date,
      'category': category,
      'accountId': accountId,
      'manualInvoiceMonth': manualInvoiceMonth,  // ⭐ ADICIONAR
      'invoiceMonthKey': invoiceMonthKey,        // ⭐ ADICIONAR
    };
  }
  
  // Método para criar cópia com novos valores
  Transaction copyWith({
    String? manualInvoiceMonth,
    String? invoiceMonthKey,
  }) {
    return Transaction(
      id: this.id,
      description: this.description,
      amount: this.amount,
      date: this.date,
      category: this.category,
      accountId: this.accountId,
      manualInvoiceMonth: manualInvoiceMonth ?? this.manualInvoiceMonth,
      invoiceMonthKey: invoiceMonthKey ?? this.invoiceMonthKey,
    );
  }
}
```

#### 3.2. Função para Mover Transação de Fatura

```dart
// transaction_service.dart
class TransactionService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  
  /// Move uma transação para outra fatura
  /// 
  /// [userId] - ID do usuário
  /// [transactionId] - ID da transação
  /// [targetMonthKey] - Mês da fatura de destino (formato: YYYY-MM)
  /// [isRemoveOverride] - Se true, remove o override manual (volta ao automático)
  Future<void> moveTransactionToInvoice({
    required String userId,
    required String transactionId,
    required String targetMonthKey,
    bool isRemoveOverride = false,
  }) async {
    try {
      // Determinar a coleção correta
      // Pode ser 'transactions' ou 'creditCardTransactions'
      final collections = ['transactions', 'creditCardTransactions'];
      
      for (final collectionName in collections) {
        final docRef = _firestore
            .collection('users')
            .doc(userId)
            .collection(collectionName)
            .doc(transactionId);
        
        // Verificar se o documento existe nesta coleção
        final docSnapshot = await docRef.get();
        if (!docSnapshot.exists) continue;
        
        // Atualizar o documento
        if (isRemoveOverride) {
          // Remover o override manual (volta ao cálculo automático)
          await docRef.update({
            'manualInvoiceMonth': FieldValue.delete(),
            'invoiceMonthKey': FieldValue.delete(),
          });
          print('[moveTransactionToInvoice] Override removido: $transactionId');
        } else {
          // Definir o override manual
          await docRef.update({
            'manualInvoiceMonth': targetMonthKey,
            'invoiceMonthKey': targetMonthKey,
          });
          print('[moveTransactionToInvoice] Transação movida: $transactionId → $targetMonthKey');
        }
        
        return; // Sucesso, sair do loop
      }
      
      throw Exception('Transação não encontrada em nenhuma coleção');
    } catch (e) {
      print('[moveTransactionToInvoice] Erro: $e');
      rethrow;
    }
  }
}
```

#### 3.3. UI - Dropdown para Mover Transação

```dart
// invoice_selector_widget.dart
import 'package:flutter/material.dart';

class InvoiceSelectorWidget extends StatelessWidget {
  final Transaction transaction;
  final String currentInvoiceMonth;
  final List<InvoiceOption> availableInvoices;
  final Function(String targetMonth) onMoveToInvoice;
  final VoidCallback? onRemoveOverride;
  
  const InvoiceSelectorWidget({
    Key? key,
    required this.transaction,
    required this.currentInvoiceMonth,
    required this.availableInvoices,
    required this.onMoveToInvoice,
    this.onRemoveOverride,
  }) : super(key: key);
  
  @override
  Widget build(BuildContext context) {
    final hasManualOverride = transaction.manualInvoiceMonth != null;
    
    return PopupMenuButton<String>(
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: hasManualOverride 
              ? Colors.purple.withOpacity(0.1) 
              : Colors.grey.withOpacity(0.1),
          borderRadius: BorderRadius.circular(4),
          border: Border.all(
            color: hasManualOverride 
                ? Colors.purple.withOpacity(0.3) 
                : Colors.grey.withOpacity(0.3),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (hasManualOverride) 
              Icon(Icons.edit, size: 12, color: Colors.purple),
            SizedBox(width: 4),
            Text(
              _formatMonthKey(currentInvoiceMonth),
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: hasManualOverride ? Colors.purple : Colors.grey[600],
              ),
            ),
            Icon(Icons.arrow_drop_down, size: 16),
          ],
        ),
      ),
      itemBuilder: (context) {
        final items = <PopupMenuEntry<String>>[];
        
        // Cabeçalho
        items.add(
          PopupMenuItem<String>(
            enabled: false,
            child: Text(
              'Mover para fatura...',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: Colors.grey[500],
              ),
            ),
          ),
        );
        
        // Opções de faturas
        for (final invoice in availableInvoices) {
          items.add(
            PopupMenuItem<String>(
              value: invoice.monthKey,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(invoice.label),
                  if (invoice.monthKey == currentInvoiceMonth)
                    Icon(Icons.check, size: 16, color: Colors.green),
                ],
              ),
            ),
          );
        }
        
        // Opção para remover override
        if (hasManualOverride && onRemoveOverride != null) {
          items.add(PopupMenuDivider());
          items.add(
            PopupMenuItem<String>(
              value: '__remove_override__',
              child: Row(
                children: [
                  Icon(Icons.close, size: 16, color: Colors.red),
                  SizedBox(width: 8),
                  Text(
                    'Remover ajuste manual',
                    style: TextStyle(color: Colors.red),
                  ),
                ],
              ),
            ),
          );
        }
        
        return items;
      },
      onSelected: (value) {
        if (value == '__remove_override__') {
          onRemoveOverride?.call();
        } else {
          onMoveToInvoice(value);
        }
      },
    );
  }
  
  String _formatMonthKey(String monthKey) {
    // Converter "2026-02" para "Fev/26"
    final parts = monthKey.split('-');
    if (parts.length != 2) return monthKey;
    
    final year = parts[0].substring(2); // "2026" → "26"
    final month = int.parse(parts[1]);
    
    const monthNames = [
      '', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];
    
    return '${monthNames[month]}/$year';
  }
}

class InvoiceOption {
  final String monthKey;  // "2026-02"
  final String label;     // "Fevereiro 2026"
  
  InvoiceOption({required this.monthKey, required this.label});
}
```

#### 3.4. Uso na Tela de Transações

```dart
// transaction_list_screen.dart
class TransactionListScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final transactionService = TransactionService();
    final userId = context.read<AuthProvider>().userId;
    
    return ListView.builder(
      itemCount: transactions.length,
      itemBuilder: (context, index) {
        final transaction = transactions[index];
        
        return ListTile(
          title: Text(transaction.description),
          subtitle: Row(
            children: [
              Text('R\$ ${transaction.amount.toStringAsFixed(2)}'),
              SizedBox(width: 16),
              // ⭐ ADICIONAR ESTE WIDGET
              InvoiceSelectorWidget(
                transaction: transaction,
                currentInvoiceMonth: transaction.manualInvoiceMonth ?? 
                    _calculateInvoiceMonth(transaction),
                availableInvoices: [
                  InvoiceOption(
                    monthKey: '2026-01',
                    label: 'Janeiro 2026 (Fechada)',
                  ),
                  InvoiceOption(
                    monthKey: '2026-02',
                    label: 'Fevereiro 2026 (Atual)',
                  ),
                  InvoiceOption(
                    monthKey: '2026-03',
                    label: 'Março 2026 (Futura)',
                  ),
                ],
                onMoveToInvoice: (targetMonth) async {
                  try {
                    await transactionService.moveTransactionToInvoice(
                      userId: userId,
                      transactionId: transaction.id,
                      targetMonthKey: targetMonth,
                    );
                    
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Transação movida com sucesso!')),
                    );
                  } catch (e) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Erro ao mover transação: $e')),
                    );
                  }
                },
                onRemoveOverride: () async {
                  try {
                    await transactionService.moveTransactionToInvoice(
                      userId: userId,
                      transactionId: transaction.id,
                      targetMonthKey: '',
                      isRemoveOverride: true,
                    );
                    
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Ajuste manual removido!')),
                    );
                  } catch (e) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Erro ao remover ajuste: $e')),
                    );
                  }
                },
              ),
            ],
          ),
        );
      },
    );
  }
  
  String _calculateInvoiceMonth(Transaction transaction) {
    // Implementar lógica de cálculo automático
    // baseado na data da transação e dia de fechamento do cartão
    // (pode ser simplificado para apenas retornar o mês da transação)
    return transaction.date.substring(0, 7); // "2026-02-15" → "2026-02"
  }
}
```

## 🔄 Fluxo Completo de Sincronização

### Cenário 1: Mover no Web
```
1. Usuário clica no dropdown da fatura no web
2. Seleciona "Março 2026"
3. Web chama: updateTransaction({ manualInvoiceMonth: "2026-03" })
4. Firestore atualiza o documento
5. App recebe notificação via listener
6. App atualiza a UI automaticamente
7. ✅ Sincronizado!
```

### Cenário 2: Mover no App (APÓS CORREÇÃO)
```
1. Usuário clica no dropdown da fatura no app
2. Seleciona "Março 2026"
3. App chama: moveTransactionToInvoice(targetMonthKey: "2026-03")
4. Firestore atualiza o documento
5. Web recebe notificação via listener
6. Web atualiza a UI automaticamente
7. ✅ Sincronizado!
```

## 📊 Estrutura no Firestore

```
users/
└── {userId}/
    ├── transactions/
    │   └── {transactionId}/
    │       ├── description: "Compra no mercado"
    │       ├── amount: -150.00
    │       ├── date: "2026-02-15"
    │       ├── category: "groceries"
    │       ├── accountId: "card_123"
    │       ├── manualInvoiceMonth: "2026-03"  ← ⭐ CAMPO IMPORTANTE
    │       └── invoiceMonthKey: "2026-03"     ← ⭐ OPCIONAL
    │
    └── creditCardTransactions/
        └── {transactionId}/
            ├── description: "Compra parcelada"
            ├── amount: -300.00
            ├── date: "2026-02-10"
            ├── category: "shopping"
            ├── accountId: "card_123"
            ├── manualInvoiceMonth: "2026-04"  ← ⭐ CAMPO IMPORTANTE
            └── invoiceMonthKey: "2026-04"     ← ⭐ OPCIONAL
```

## ✅ Checklist de Implementação

- [ ] Atualizar modelo `Transaction` com campos `manualInvoiceMonth` e `invoiceMonthKey`
- [ ] Criar função `moveTransactionToInvoice` no serviço
- [ ] Criar widget `InvoiceSelectorWidget` para UI
- [ ] Integrar widget na tela de transações
- [ ] Testar: mover transação no app e verificar no web
- [ ] Testar: remover override manual
- [ ] Testar: sincronização bidirecional

## 🐛 Troubleshooting

### Problema: Mudança no app não aparece no web
```dart
// Verificar se o campo está sendo salvo
print('Salvando manualInvoiceMonth: $targetMonthKey');

// Verificar se o documento foi atualizado
final doc = await docRef.get();
print('Documento atualizado: ${doc.data()}');
```

### Problema: Transação não encontrada
```dart
// Verificar em ambas as coleções
final collections = ['transactions', 'creditCardTransactions'];
for (final collection in collections) {
  final doc = await _firestore
      .collection('users')
      .doc(userId)
      .collection(collection)
      .doc(transactionId)
      .get();
  print('$collection: ${doc.exists}');
}
```

## 🎯 Resultado Esperado

Após implementar esta correção:
- ✅ Mover transação no web → Atualiza no app
- ✅ Mover transação no app → Atualiza no web
- ✅ Sincronização bidirecional funcionando
- ✅ Override manual funcionando corretamente
- ✅ Remover override funcionando

## 📝 Notas Importantes

1. **Duas coleções**: Transações podem estar em `transactions` ou `creditCardTransactions`
2. **Formato do mês**: Sempre usar `YYYY-MM` (ex: "2026-02")
3. **Listeners**: O Firestore notifica automaticamente todas as mudanças
4. **Compatibilidade**: Salvar ambos `manualInvoiceMonth` e `invoiceMonthKey` para compatibilidade

## 🚀 Próximos Passos

1. Implementar as mudanças no código do app mobile
2. Testar a sincronização em ambas as direções
3. Verificar se os listeners estão funcionando corretamente
4. Confirmar que a UI atualiza automaticamente

Boa sorte! 🎉
