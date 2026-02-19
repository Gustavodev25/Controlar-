# ⚡ Guia Rápido - Sincronização de Categorias entre Web e App

## 🎯 Objetivo
Fazer com que as categorias personalizadas na web apareçam automaticamente no app mobile e vice-versa.

---

## 📚 Documentação Completa

1. **[SINCRONIZACAO_CATEGORIAS_TRANSACOES.md](./SINCRONIZACAO_CATEGORIAS_TRANSACOES.md)** 
   - Como funciona a sincronização das categorias nas transações
   - Código completo para implementar no app
   - **LEIA ESTE PRIMEIRO!**

2. **[INSTRUCOES_CATEGORIAS_APP.md](./INSTRUCOES_CATEGORIAS_APP.md)**
   - Como implementar a tela de gestão de categorias no app
   - Criar, editar e deletar categorias
   - Opcional (apenas se quiser editar no app também)

---

## 🚀 Implementação Rápida (5 Passos)

### Passo 1: Criar o Serviço de Mapeamento
```dart
// category_mapping_service.dart
class CategoryMappingService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  Map<String, String> _categoryCache = {};
  
  Stream<Map<String, String>> getCategoryMappingsStream(String userId) {
    return _firestore
        .collection('users')
        .doc(userId)
        .collection('categoryMappings')
        .snapshots()
        .map((snapshot) {
      final mappings = <String, String>{};
      for (var doc in snapshot.docs) {
        final data = doc.data();
        mappings[data['originalKey'].toLowerCase()] = data['displayName'];
      }
      return mappings;
    });
  }
  
  String getDisplayName(String originalCategory) {
    final key = originalCategory.toLowerCase();
    return _categoryCache[key] ?? originalCategory;
  }
}
```

### Passo 2: Atualizar Modelo de Transação
```dart
// transaction_model.dart
class Transaction {
  final String category;           // Chave original (do banco)
  final String? categoryDisplay;   // Nome personalizado (calculado)
  
  String get displayCategory => categoryDisplay ?? category;
  
  Transaction copyWith({String? categoryDisplay}) {
    return Transaction(
      // ... outros campos
      categoryDisplay: categoryDisplay ?? this.categoryDisplay,
    );
  }
}
```

### Passo 3: Criar Provider com Listeners
```dart
// transaction_provider.dart
class TransactionProvider with ChangeNotifier {
  List<Transaction> _transactions = [];
  Map<String, String> _categoryMappings = {};
  
  void initialize(String userId) {
    // Listener para transações
    FirebaseFirestore.instance
        .collection('users')
        .doc(userId)
        .collection('transactions')
        .snapshots()
        .listen((snapshot) {
      _transactions = snapshot.docs
          .map((doc) => Transaction.fromFirestore(doc))
          .toList();
      _applyMappings();
      notifyListeners();
    });
    
    // Listener para mapeamentos
    CategoryMappingService()
        .getCategoryMappingsStream(userId)
        .listen((mappings) {
      _categoryMappings = mappings;
      _applyMappings();
      notifyListeners();
    });
  }
  
  void _applyMappings() {
    _transactions = _transactions.map((tx) {
      final displayName = _categoryMappings[tx.category.toLowerCase()] 
          ?? tx.category;
      return tx.copyWith(categoryDisplay: displayName);
    }).toList();
  }
}
```

### Passo 4: Usar na UI
```dart
// transaction_list_screen.dart
ListTile(
  title: Text(transaction.description),
  subtitle: Text(transaction.displayCategory), // ← Nome personalizado
  trailing: Text('R\$ ${transaction.amount}'),
)
```

### Passo 5: Inicializar no App
```dart
// main.dart
void main() {
  runApp(
    ChangeNotifierProvider(
      create: (_) => TransactionProvider(),
      child: MyApp(),
    ),
  );
}

// Após login
@override
void initState() {
  super.initState();
  Provider.of<TransactionProvider>(context, listen: false)
      .initialize(userId);
}
```

---

## ✅ Teste Rápido

1. **Abra a web** e vá em "Gestão de Categorias"
2. **Mude uma categoria**, ex: "groceries" → "Supermercado"
3. **Abra o app** e veja as transações
4. **Resultado esperado**: Transações com "groceries" mostram "Supermercado"

---

## 🔄 Como Funciona

```
┌─────────────────────────────────────────────────────────┐
│                  FIREBASE FIRESTORE                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Transação armazena:     category: "groceries"          │
│  Mapeamento armazena:    displayName: "Supermercado"    │
│                                                           │
│  App/Web aplicam o mapeamento na EXIBIÇÃO               │
│  (não modifica o banco)                                  │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Fluxo de Sincronização
```
1. Usuário edita na web: "groceries" → "Supermercado"
2. Web salva em categoryMappings
3. Firestore notifica o app via listener
4. App atualiza cache de mapeamentos
5. App reaplica mapeamentos nas transações
6. UI atualiza automaticamente
7. ✅ Sincronizado!
```

---

## 🎯 Pontos Importantes

### ✅ O QUE FAZER
- Armazenar chave original na transação (`category: "groceries"`)
- Aplicar mapeamento na exibição (`displayCategory`)
- Usar listeners para sincronização em tempo real
- Manter cache local dos mapeamentos

### ❌ O QUE NÃO FAZER
- Não modificar o campo `category` das transações existentes
- Não armazenar `categoryDisplay` no Firestore
- Não fazer polling manual (use listeners)
- Não duplicar dados

---

## 📊 Estrutura no Firestore

```
users/
└── {userId}/
    ├── transactions/
    │   └── {transactionId}/
    │       ├── description: "Compra no mercado"
    │       ├── amount: 150.00
    │       └── category: "groceries" ← Chave original
    │
    └── categoryMappings/
        └── groceries/
            ├── originalKey: "groceries"
            ├── displayName: "Supermercado" ← Nome personalizado
            ├── isDefault: false
            └── group: "Alimentação"
```

---

## 🐛 Troubleshooting

### Problema: Categorias não aparecem no app
**Solução**: Verifique se o listener está ativo
```dart
// Adicione logs
_categoryService.getCategoryMappingsStream(userId).listen((mappings) {
  print('Mapeamentos recebidos: ${mappings.length}');
  _categoryMappings = mappings;
});
```

### Problema: Mudanças na web não aparecem no app
**Solução**: Verifique se o userId está correto
```dart
print('UserId: $userId');
```

### Problema: App mostra categoria original
**Solução**: Verifique se o mapeamento está sendo aplicado
```dart
void _applyMappings() {
  print('Aplicando mapeamentos: ${_categoryMappings.length}');
  // ... resto do código
}
```

---

## 📞 Precisa de Ajuda?

1. Leia **[SINCRONIZACAO_CATEGORIAS_TRANSACOES.md](./SINCRONIZACAO_CATEGORIAS_TRANSACOES.md)** para detalhes completos
2. Verifique os arquivos de referência na web:
   - `services/database.ts` (linhas 3550-3700)
   - `components/CategoryManager.tsx`
   - `types.ts` (interface CategoryMapping)

---

## 🎉 Pronto!

Após implementar estes 5 passos, seu app estará sincronizado com a web automaticamente!

**Tempo estimado**: 30-60 minutos
**Dificuldade**: Média
**Resultado**: Sincronização automática e em tempo real ⚡
