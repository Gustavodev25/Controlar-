# 🔄 Sincronização de Categorias nas Transações entre Web e App

## 📋 Problema
As transações têm um campo `category` que precisa ser sincronizado entre web e app. Quando o usuário personaliza uma categoria na Gestão de Categorias, todas as transações devem exibir o nome personalizado.

## ✅ Solução Implementada

### Arquitetura
```
┌─────────────────────────────────────────────────────────────┐
│                    FIREBASE FIRESTORE                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  users/{userId}/                                             │
│  ├── transactions/{transactionId}                           │
│  │   └── category: "groceries" (chave original)             │
│  │                                                           │
│  └── categoryMappings/{categoryId}                          │
│      ├── originalKey: "groceries"                           │
│      └── displayName: "Supermercado" (personalizado)        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
         ↓                                    ↓
    ┌────────┐                          ┌─────────┐
    │   WEB  │                          │   APP   │
    └────────┘                          └─────────┘
```

### Princípios
1. **Transações armazenam a chave original** (`category: "groceries"`)
2. **Mapeamento é feito na exibição** (não no banco)
3. **CategoryMappings é a fonte da verdade** para nomes personalizados
4. **Sincronização automática** via Firestore listeners

---

## 🌐 Implementação na Web (Já Feito)

### 1. Como a Web Aplica o Mapeamento

A web já está aplicando o mapeamento corretamente. Veja como funciona:

```typescript
// App.tsx - Carrega os mapeamentos
const [categoryMappings, setCategoryMappings] = useState<CategoryMapping[]>([]);

useEffect(() => {
  const unsubMapping = dbService.listenToCategoryMappings(uid, setCategoryMappings);
  return () => unsubMapping();
}, [userId]);

// Quando exibe uma transação
const displayCategory = getCategoryDisplayName(transaction.category, categoryMappings);

// Função helper
function getCategoryDisplayName(originalKey: string, mappings: CategoryMapping[]): string {
  const mapping = mappings.find(m => 
    m.originalKey.toLowerCase() === originalKey.toLowerCase()
  );
  return mapping?.displayName || originalKey;
}
```

### 2. Estrutura da Transação no Firestore

```json
{
  "id": "abc123",
  "description": "Compra no mercado",
  "amount": 150.00,
  "category": "groceries",  // ← Chave original (não muda)
  "type": "expense",
  "date": "2025-02-18",
  "status": "completed"
}
```

### 3. Estrutura do Mapeamento no Firestore

```json
{
  "id": "groceries",
  "originalKey": "groceries",
  "displayName": "Supermercado",  // ← Nome personalizado
  "isDefault": false,
  "group": "Alimentação",
  "updatedAt": "2025-02-18T10:30:00.000Z"
}
```

---

## 📱 Implementação no App Mobile

### 1. Criar Serviço de Mapeamento de Categorias

```dart
// category_mapping_service.dart
import 'package:cloud_firestore/cloud_firestore.dart';

class CategoryMappingService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  
  // Cache local dos mapeamentos
  Map<String, String> _categoryCache = {};
  
  // Stream para escutar mudanças em tempo real
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
        final originalKey = (data['originalKey'] as String).toLowerCase();
        final displayName = data['displayName'] as String;
        mappings[originalKey] = displayName;
      }
      
      return mappings;
    });
  }
  
  // Carregar mapeamentos uma vez
  Future<Map<String, String>> loadCategoryMappings(String userId) async {
    try {
      final snapshot = await _firestore
          .collection('users')
          .doc(userId)
          .collection('categoryMappings')
          .get();
      
      final mappings = <String, String>{};
      
      for (var doc in snapshot.docs) {
        final data = doc.data();
        final originalKey = (data['originalKey'] as String).toLowerCase();
        final displayName = data['displayName'] as String;
        mappings[originalKey] = displayName;
      }
      
      _categoryCache = mappings;
      return mappings;
    } catch (e) {
      print('Erro ao carregar mapeamentos: $e');
      return {};
    }
  }
  
  // Aplicar mapeamento em uma categoria
  String getDisplayName(String originalCategory) {
    if (originalCategory.isEmpty) return originalCategory;
    
    final key = originalCategory.toLowerCase();
    return _categoryCache[key] ?? originalCategory;
  }
  
  // Aplicar mapeamento em uma lista de transações
  List<Transaction> applyMappingsToTransactions(
    List<Transaction> transactions,
    Map<String, String> mappings,
  ) {
    return transactions.map((tx) {
      final key = tx.category.toLowerCase();
      final displayName = mappings[key] ?? tx.category;
      
      return tx.copyWith(
        // Mantém a categoria original no objeto
        // Mas adiciona um campo para exibição
        categoryDisplay: displayName,
      );
    }).toList();
  }
}
```

### 2. Atualizar Modelo de Transação

```dart
// transaction_model.dart
class Transaction {
  final String id;
  final String description;
  final double amount;
  final String category;           // ← Chave original (do banco)
  final String? categoryDisplay;   // ← Nome para exibição (calculado)
  final String type;
  final String date;
  final String status;
  
  Transaction({
    required this.id,
    required this.description,
    required this.amount,
    required this.category,
    this.categoryDisplay,
    required this.type,
    required this.date,
    required this.status,
  });
  
  // Getter para pegar o nome de exibição
  String get displayCategory => categoryDisplay ?? category;
  
  factory Transaction.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return Transaction(
      id: doc.id,
      description: data['description'] ?? '',
      amount: (data['amount'] ?? 0).toDouble(),
      category: data['category'] ?? '',
      // categoryDisplay será preenchido depois
      type: data['type'] ?? 'expense',
      date: data['date'] ?? '',
      status: data['status'] ?? 'completed',
    );
  }
  
  Transaction copyWith({
    String? id,
    String? description,
    double? amount,
    String? category,
    String? categoryDisplay,
    String? type,
    String? date,
    String? status,
  }) {
    return Transaction(
      id: id ?? this.id,
      description: description ?? this.description,
      amount: amount ?? this.amount,
      category: category ?? this.category,
      categoryDisplay: categoryDisplay ?? this.categoryDisplay,
      type: type ?? this.type,
      date: date ?? this.date,
      status: status ?? this.status,
    );
  }
}
```

### 3. Provider/Controller para Gerenciar Estado

```dart
// transaction_provider.dart
import 'package:flutter/foundation.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class TransactionProvider with ChangeNotifier {
  final CategoryMappingService _categoryService = CategoryMappingService();
  
  List<Transaction> _transactions = [];
  Map<String, String> _categoryMappings = {};
  bool _isLoading = false;
  
  List<Transaction> get transactions => _transactions;
  bool get isLoading => _isLoading;
  
  // Inicializar listeners
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
      
      // Aplica mapeamentos nas transações
      _applyMappings();
      notifyListeners();
    });
    
    // Listener para mapeamentos de categorias
    _categoryService.getCategoryMappingsStream(userId).listen((mappings) {
      _categoryMappings = mappings;
      
      // Reaplica mapeamentos quando mudam
      _applyMappings();
      notifyListeners();
    });
  }
  
  // Aplica os mapeamentos nas transações carregadas
  void _applyMappings() {
    _transactions = _transactions.map((tx) {
      final key = tx.category.toLowerCase();
      final displayName = _categoryMappings[key] ?? tx.category;
      
      return tx.copyWith(categoryDisplay: displayName);
    }).toList();
  }
  
  // Adicionar transação (mantém categoria original)
  Future<void> addTransaction(String userId, Transaction transaction) async {
    try {
      await FirebaseFirestore.instance
          .collection('users')
          .doc(userId)
          .collection('transactions')
          .add({
        'description': transaction.description,
        'amount': transaction.amount,
        'category': transaction.category, // ← Salva chave original
        'type': transaction.type,
        'date': transaction.date,
        'status': transaction.status,
      });
    } catch (e) {
      print('Erro ao adicionar transação: $e');
      rethrow;
    }
  }
  
  // Atualizar transação (mantém categoria original)
  Future<void> updateTransaction(String userId, Transaction transaction) async {
    try {
      await FirebaseFirestore.instance
          .collection('users')
          .doc(userId)
          .collection('transactions')
          .doc(transaction.id)
          .update({
        'description': transaction.description,
        'amount': transaction.amount,
        'category': transaction.category, // ← Mantém chave original
        'type': transaction.type,
        'date': transaction.date,
        'status': transaction.status,
      });
    } catch (e) {
      print('Erro ao atualizar transação: $e');
      rethrow;
    }
  }
}
```

### 4. UI - Exibir Transações com Categoria Mapeada

```dart
// transaction_list_screen.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class TransactionListScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Consumer<TransactionProvider>(
      builder: (context, provider, child) {
        if (provider.isLoading) {
          return Center(child: CircularProgressIndicator());
        }
        
        return ListView.builder(
          itemCount: provider.transactions.length,
          itemBuilder: (context, index) {
            final transaction = provider.transactions[index];
            
            return ListTile(
              title: Text(transaction.description),
              subtitle: Text(
                transaction.displayCategory, // ← Usa nome mapeado
                style: TextStyle(color: Colors.grey[600]),
              ),
              trailing: Text(
                'R\$ ${transaction.amount.toStringAsFixed(2)}',
                style: TextStyle(
                  color: transaction.type == 'income' 
                      ? Colors.green 
                      : Colors.red,
                  fontWeight: FontWeight.bold,
                ),
              ),
            );
          },
        );
      },
    );
  }
}
```

### 5. Inicializar no App

```dart
// main.dart
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => TransactionProvider()),
        // ... outros providers
      ],
      child: MyApp(),
    ),
  );
}

// Após login
class HomeScreen extends StatefulWidget {
  final String userId;
  
  const HomeScreen({required this.userId});
  
  @override
  _HomeScreenState createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    
    // Inicializa os listeners
    final provider = Provider.of<TransactionProvider>(context, listen: false);
    provider.initialize(widget.userId);
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Transações')),
      body: TransactionListScreen(),
    );
  }
}
```

---

## 🔄 Fluxo de Sincronização Completo

### Cenário 1: Usuário Edita Categoria na Web
```
1. Web: Usuário muda "groceries" → "Supermercado"
2. Web: Salva em categoryMappings/{groceries}
3. Firestore: Atualiza documento
4. App: Listener detecta mudança
5. App: Atualiza _categoryMappings
6. App: Reaplica mapeamentos em todas as transações
7. App: UI atualiza automaticamente (notifyListeners)
8. ✅ Transações no app mostram "Supermercado"
```

### Cenário 2: Usuário Cria Transação no App
```
1. App: Usuário cria transação com category: "groceries"
2. App: Salva em transactions/{id} com chave original
3. Firestore: Cria documento
4. App: Listener detecta nova transação
5. App: Aplica mapeamento (groceries → Supermercado)
6. App: UI mostra "Supermercado"
7. Web: Listener detecta nova transação
8. Web: Aplica mapeamento
9. ✅ Web também mostra "Supermercado"
```

### Cenário 3: Usuário Cria Categoria Customizada na Web
```
1. Web: Usuário cria categoria "Pets" no grupo "Outros"
2. Web: Salva em categoryMappings/{custom_xyz}
3. Firestore: Cria documento
4. App: Listener detecta nova categoria
5. App: Adiciona ao _categoryMappings
6. ✅ Categoria "Pets" disponível no app
```

---

## 🎯 Vantagens desta Abordagem

### ✅ Separação de Responsabilidades
- **Transações**: Armazenam dados brutos (chave original)
- **CategoryMappings**: Armazenam personalizações
- **UI**: Aplica mapeamento na exibição

### ✅ Sincronização Automática
- Mudanças na web aparecem instantaneamente no app
- Mudanças no app aparecem instantaneamente na web
- Sem necessidade de refresh manual

### ✅ Performance
- Mapeamentos são carregados uma vez e mantidos em cache
- Aplicação do mapeamento é feita em memória (rápido)
- Listeners do Firestore são eficientes

### ✅ Consistência
- Fonte única de verdade (Firestore)
- Não há duplicação de dados
- Fácil de manter e debugar

### ✅ Flexibilidade
- Usuário pode personalizar categorias sem afetar dados históricos
- Pode resetar para padrão a qualquer momento
- Pode criar categorias customizadas

---

## 🐛 Tratamento de Casos Especiais

### 1. Categoria Não Mapeada
```dart
String getDisplayName(String originalCategory) {
  final key = originalCategory.toLowerCase();
  return _categoryMappings[key] ?? originalCategory; // Fallback
}
```

### 2. Transação Antiga com Categoria Inexistente
```dart
// Se a transação tem category: "old_category" que não existe mais
// O app mostra o nome original até que seja mapeada
```

### 3. Sincronização Offline
```dart
// Firestore tem cache offline automático
// Quando voltar online, sincroniza automaticamente
```

### 4. Múltiplos Dispositivos
```dart
// Listeners garantem que todos os dispositivos recebem atualizações
// Não importa onde a mudança foi feita
```

---

## 📊 Exemplo Completo de Fluxo

### Estado Inicial
```
Firestore:
  transactions/tx1: { category: "groceries" }
  categoryMappings/groceries: { displayName: "Compras" }

Web: Mostra "Compras"
App: Mostra "Compras"
```

### Usuário Edita na Web
```
Web: Muda para "Supermercado"
Firestore: categoryMappings/groceries: { displayName: "Supermercado" }

Web: Mostra "Supermercado" (imediato)
App: Listener detecta → Mostra "Supermercado" (< 1 segundo)
```

### Usuário Cria Transação no App
```
App: Cria transaction com category: "groceries"
Firestore: transactions/tx2: { category: "groceries" }

App: Aplica mapeamento → Mostra "Supermercado"
Web: Listener detecta → Aplica mapeamento → Mostra "Supermercado"
```

---

## ✅ Checklist de Implementação

### Básico (Apenas Leitura)
- [ ] Criar `CategoryMappingService`
- [ ] Atualizar modelo `Transaction` com `categoryDisplay`
- [ ] Criar `TransactionProvider` com listeners
- [ ] Aplicar mapeamento na UI
- [ ] Testar: editar categoria na web e ver no app

### Avançado (Edição no App)
- [ ] Criar tela de gestão de categorias no app
- [ ] Implementar edição de categorias
- [ ] Implementar criação de categorias customizadas
- [ ] Implementar exclusão de categorias
- [ ] Testar sincronização bidirecional

### Otimizações
- [ ] Implementar cache local persistente
- [ ] Adicionar loading states
- [ ] Adicionar error handling
- [ ] Implementar retry logic
- [ ] Adicionar analytics

---

## 🚀 Próximos Passos

1. **Implementar CategoryMappingService** no app
2. **Atualizar modelo Transaction** com campo `categoryDisplay`
3. **Criar TransactionProvider** com listeners
4. **Testar sincronização** editando na web
5. **Implementar UI de gestão** (opcional)

---

## 📞 Suporte Técnico

### Arquivos de Referência na Web
- `services/database.ts` (linhas 3550-3700) - Funções de categoria
- `components/CategoryManager.tsx` - UI de gestão
- `types.ts` - Interface `CategoryMapping`
- `App.tsx` (linha 610) - Como a web usa os mapeamentos

### Estrutura no Firestore
```
users/{userId}/
├── transactions/
│   └── {transactionId}/
│       └── category: "groceries"
└── categoryMappings/
    └── {categoryId}/
        ├── originalKey: "groceries"
        └── displayName: "Supermercado"
```

Boa sorte com a implementação! 🎉
