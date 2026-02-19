# 📱 Instruções para Implementar Gestão de Categorias no App Mobile

## 📋 Resumo
A funcionalidade de **Gestão de Categorias** foi implementada na versão web e permite que usuários personalizem os nomes das categorias de suas transações. Todas as mudanças são salvas no Firebase Firestore e podem ser sincronizadas com o app mobile.

## 🔗 Documentos Relacionados
- **[SINCRONIZACAO_CATEGORIAS_TRANSACOES.md](./SINCRONIZACAO_CATEGORIAS_TRANSACOES.md)** - Guia completo de como sincronizar as categorias das transações entre web e app (LEIA ESTE PRIMEIRO!)
- Este documento - Gestão de categorias (criar, editar, deletar)

---

## 🗂️ Estrutura de Dados no Firebase

### Localização no Firestore
```
users/{userId}/categoryMappings/{categoryId}
```

### Estrutura do Documento `CategoryMapping`
```typescript
interface CategoryMapping {
  id: string;                    // ID único da categoria
  originalKey: string;           // Chave original (ex: "groceries", "rent")
  displayName: string;           // Nome personalizado pelo usuário
  isDefault: boolean;            // true = categoria padrão, false = customizada
  group?: string;                // Grupo da categoria (ex: "Alimentação", "Moradia")
  icon?: string;                 // Ícone opcional
  color?: string;                // Cor opcional (hex)
  updatedAt?: string;            // Data da última atualização (ISO)
}
```

### Exemplo de Documento
```json
{
  "id": "groceries",
  "originalKey": "groceries",
  "displayName": "Supermercado",
  "isDefault": true,
  "group": "Alimentação",
  "updatedAt": "2025-02-18T10:30:00.000Z"
}
```

---

## 🔧 Funções Implementadas na Web (Referência)

### 1. Inicializar Categorias Padrão
```typescript
initializeCategoryMappings(userId: string): Promise<CategoryMapping[]>
```
- Cria as categorias padrão na primeira vez que o usuário acessa
- Se já existem categorias, retorna as existentes
- Localização: `services/database.ts` linha 3553

### 2. Atualizar Nome de Categoria
```typescript
updateCategoryMapping(userId: string, categoryId: string, displayName: string): Promise<void>
```
- Atualiza o nome de exibição de uma categoria
- Localização: `services/database.ts` linha 3596

### 3. Resetar para Padrão
```typescript
resetCategoryMapping(userId: string, categoryId: string, originalDisplayName: string): Promise<void>
```
- Restaura o nome original da categoria
- Marca `isDefault: true`

### 4. Criar Categoria Customizada
```typescript
createCustomCategory(userId: string, displayName: string, group: string): Promise<string>
```
- Cria uma nova categoria personalizada
- `originalKey` usa prefixo `custom_` + ID único
- `isDefault: false`
- Localização: `services/database.ts` linha 3656

### 5. Deletar Categoria Customizada
```typescript
deleteCategoryMapping(userId: string, categoryId: string): Promise<void>
```
- Remove uma categoria customizada
- Apenas categorias com `isDefault: false` podem ser deletadas
- Localização: `services/database.ts` linha 3687

### 6. Escutar Mudanças em Tempo Real
```typescript
listenToCategoryMappings(userId: string, callback: (mappings: CategoryMapping[]) => void)
```
- Listener em tempo real para mudanças nas categorias
- Retorna função de unsubscribe

---

## 📱 O Que Implementar no App Mobile

### 1. Criar Modelo de Dados
Crie um modelo equivalente ao `CategoryMapping`:

```dart
// Para Flutter
class CategoryMapping {
  final String id;
  final String originalKey;
  final String displayName;
  final bool isDefault;
  final String? group;
  final String? icon;
  final String? color;
  final String? updatedAt;

  CategoryMapping({
    required this.id,
    required this.originalKey,
    required this.displayName,
    required this.isDefault,
    this.group,
    this.icon,
    this.color,
    this.updatedAt,
  });

  factory CategoryMapping.fromFirestore(Map<String, dynamic> data, String id) {
    return CategoryMapping(
      id: id,
      originalKey: data['originalKey'] ?? '',
      displayName: data['displayName'] ?? '',
      isDefault: data['isDefault'] ?? true,
      group: data['group'],
      icon: data['icon'],
      color: data['color'],
      updatedAt: data['updatedAt'],
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'originalKey': originalKey,
      'displayName': displayName,
      'isDefault': isDefault,
      if (group != null) 'group': group,
      if (icon != null) 'icon': icon,
      if (color != null) 'color': color,
      'updatedAt': DateTime.now().toIso8601String(),
    };
  }
}
```

```kotlin
// Para React Native / Kotlin
data class CategoryMapping(
    val id: String,
    val originalKey: String,
    val displayName: String,
    val isDefault: Boolean,
    val group: String? = null,
    val icon: String? = null,
    val color: String? = null,
    val updatedAt: String? = null
)
```

### 2. Criar Serviço de Categorias

```dart
// Flutter Example
import 'package:cloud_firestore/cloud_firestore.dart';

class CategoryService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  // Buscar todas as categorias do usuário
  Future<List<CategoryMapping>> getCategoryMappings(String userId) async {
    try {
      final snapshot = await _firestore
          .collection('users')
          .doc(userId)
          .collection('categoryMappings')
          .get();

      return snapshot.docs
          .map((doc) => CategoryMapping.fromFirestore(doc.data(), doc.id))
          .toList();
    } catch (e) {
      print('Erro ao buscar categorias: $e');
      return [];
    }
  }

  // Escutar mudanças em tempo real
  Stream<List<CategoryMapping>> listenToCategoryMappings(String userId) {
    return _firestore
        .collection('users')
        .doc(userId)
        .collection('categoryMappings')
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => CategoryMapping.fromFirestore(doc.data(), doc.id))
            .toList());
  }

  // Atualizar nome de categoria
  Future<void> updateCategoryMapping(
    String userId,
    String categoryId,
    String displayName,
  ) async {
    try {
      await _firestore
          .collection('users')
          .doc(userId)
          .collection('categoryMappings')
          .doc(categoryId)
          .update({
        'displayName': displayName,
        'updatedAt': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      print('Erro ao atualizar categoria: $e');
      throw e;
    }
  }

  // Criar categoria customizada
  Future<String> createCustomCategory(
    String userId,
    String displayName,
    String group,
  ) async {
    try {
      final docRef = _firestore
          .collection('users')
          .doc(userId)
          .collection('categoryMappings')
          .doc();

      final id = docRef.id;
      final originalKey = 'custom_$id';

      final mapping = CategoryMapping(
        id: id,
        originalKey: originalKey,
        displayName: displayName,
        isDefault: false,
        group: group,
      );

      await docRef.set(mapping.toFirestore());
      return id;
    } catch (e) {
      print('Erro ao criar categoria: $e');
      throw e;
    }
  }

  // Deletar categoria customizada
  Future<void> deleteCategoryMapping(String userId, String categoryId) async {
    try {
      await _firestore
          .collection('users')
          .doc(userId)
          .collection('categoryMappings')
          .doc(categoryId)
          .delete();
    } catch (e) {
      print('Erro ao deletar categoria: $e');
      throw e;
    }
  }

  // Resetar para padrão
  Future<void> resetCategoryMapping(
    String userId,
    String categoryId,
    String originalDisplayName,
  ) async {
    try {
      await _firestore
          .collection('users')
          .doc(userId)
          .collection('categoryMappings')
          .doc(categoryId)
          .update({
        'displayName': originalDisplayName,
        'isDefault': true,
        'updatedAt': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      print('Erro ao resetar categoria: $e');
      throw e;
    }
  }
}
```

### 3. Aplicar Mapeamento nas Transações

Quando exibir transações no app, aplique o mapeamento:

```dart
class TransactionService {
  final CategoryService _categoryService = CategoryService();
  Map<String, String> _categoryMappings = {};

  // Carregar mapeamentos
  Future<void> loadCategoryMappings(String userId) async {
    final mappings = await _categoryService.getCategoryMappings(userId);
    _categoryMappings = {
      for (var mapping in mappings)
        mapping.originalKey.toLowerCase(): mapping.displayName
    };
  }

  // Aplicar mapeamento em uma transação
  String getDisplayCategory(String originalCategory) {
    final key = originalCategory.toLowerCase();
    return _categoryMappings[key] ?? originalCategory;
  }

  // Exemplo de uso ao exibir transação
  Widget buildTransactionCard(Transaction transaction) {
    final displayCategory = getDisplayCategory(transaction.category);
    
    return Card(
      child: ListTile(
        title: Text(transaction.description),
        subtitle: Text(displayCategory), // Usa o nome personalizado
        trailing: Text('R\$ ${transaction.amount}'),
      ),
    );
  }
}
```

### 4. Criar Tela de Gestão de Categorias (Opcional)

Se quiser permitir edição no app também:

```dart
class CategoryManagementScreen extends StatefulWidget {
  final String userId;

  const CategoryManagementScreen({required this.userId});

  @override
  _CategoryManagementScreenState createState() => _CategoryManagementScreenState();
}

class _CategoryManagementScreenState extends State<CategoryManagementScreen> {
  final CategoryService _categoryService = CategoryService();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Gestão de Categorias'),
      ),
      body: StreamBuilder<List<CategoryMapping>>(
        stream: _categoryService.listenToCategoryMappings(widget.userId),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return Center(child: CircularProgressIndicator());
          }

          if (!snapshot.hasData || snapshot.data!.isEmpty) {
            return Center(child: Text('Nenhuma categoria encontrada'));
          }

          final categories = snapshot.data!;

          return ListView.builder(
            itemCount: categories.length,
            itemBuilder: (context, index) {
              final category = categories[index];
              return ListTile(
                title: Text(category.displayName),
                subtitle: Text(category.originalKey),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: Icon(Icons.edit),
                      onPressed: () => _editCategory(category),
                    ),
                    if (!category.isDefault)
                      IconButton(
                        icon: Icon(Icons.delete),
                        onPressed: () => _deleteCategory(category),
                      ),
                  ],
                ),
              );
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        child: Icon(Icons.add),
        onPressed: _createCategory,
      ),
    );
  }

  Future<void> _editCategory(CategoryMapping category) async {
    final controller = TextEditingController(text: category.displayName);
    
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Editar Categoria'),
        content: TextField(
          controller: controller,
          decoration: InputDecoration(labelText: 'Nome'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, controller.text),
            child: Text('Salvar'),
          ),
        ],
      ),
    );

    if (result != null && result.isNotEmpty) {
      await _categoryService.updateCategoryMapping(
        widget.userId,
        category.id,
        result,
      );
    }
  }

  Future<void> _deleteCategory(CategoryMapping category) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Confirmar Exclusão'),
        content: Text('Deseja excluir "${category.displayName}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text('Excluir'),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await _categoryService.deleteCategoryMapping(widget.userId, category.id);
    }
  }

  Future<void> _createCategory() async {
    final nameController = TextEditingController();
    final groupController = TextEditingController();

    final result = await showDialog<Map<String, String>>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Nova Categoria'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              decoration: InputDecoration(labelText: 'Nome'),
            ),
            SizedBox(height: 16),
            TextField(
              controller: groupController,
              decoration: InputDecoration(labelText: 'Grupo'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, {
              'name': nameController.text,
              'group': groupController.text,
            }),
            child: Text('Criar'),
          ),
        ],
      ),
    );

    if (result != null && result['name']!.isNotEmpty) {
      await _categoryService.createCustomCategory(
        widget.userId,
        result['name']!,
        result['group'] ?? 'Outros',
      );
    }
  }
}
```

---

## 🔄 Fluxo de Sincronização

### Cenário 1: Usuário Edita na Web
1. Usuário altera nome de categoria na web
2. Mudança é salva no Firestore
3. App mobile recebe atualização via listener em tempo real
4. Transações no app exibem novo nome automaticamente

### Cenário 2: Usuário Edita no App
1. Usuário altera nome de categoria no app
2. Mudança é salva no Firestore
3. Web recebe atualização via listener em tempo real
4. Transações na web exibem novo nome automaticamente

---

## ✅ Checklist de Implementação

### Básico (Apenas Leitura)
- [ ] Criar modelo `CategoryMapping`
- [ ] Criar serviço para buscar categorias do Firestore
- [ ] Implementar listener em tempo real
- [ ] Aplicar mapeamento ao exibir transações
- [ ] Testar sincronização: editar na web e ver no app

### Avançado (Edição no App)
- [ ] Criar tela de gestão de categorias
- [ ] Implementar função de editar categoria
- [ ] Implementar função de criar categoria customizada
- [ ] Implementar função de deletar categoria customizada
- [ ] Implementar função de resetar para padrão
- [ ] Adicionar validações (não permitir deletar categorias padrão)
- [ ] Testar sincronização bidirecional

---

## 🎨 Grupos de Categorias (Referência)

Os grupos usados na web são:

```typescript
const CATEGORY_GROUPS = {
  'Renda': ['salary', 'retirement', 'government aid', ...],
  'Transferências': ['same person transfer - pix', 'transfer - pix', ...],
  'Moradia': ['rent', 'electricity', 'water'],
  'Alimentação': ['groceries', 'eating out', 'food delivery'],
  'Transporte': ['taxi and ride-hailing', 'public transportation', ...],
  'Saúde': ['pharmacy', 'hospital clinics and labs', ...],
  'Educação': ['school', 'university'],
  'Telecom': ['telecommunications', 'internet', 'mobile'],
  'Entretenimento': ['cinema, theater and concerts', 'video streaming', ...],
  'Compras': ['online shopping', 'electronics', 'clothing'],
  'Viagem': ['airport and airlines', 'accommodation'],
  'Finanças': ['loans', 'interests charged', 'income taxes', ...],
  'Outros': ['alimony', 'donation', 'vehicle insurance'],
};
```

---

## 🐛 Tratamento de Erros

### Categoria Não Encontrada
Se uma transação tiver uma categoria que não existe no mapeamento:
```dart
String getDisplayCategory(String originalCategory) {
  final key = originalCategory.toLowerCase();
  return _categoryMappings[key] ?? originalCategory; // Fallback para original
}
```

### Categorias Padrão Não Inicializadas
Se o usuário nunca acessou a gestão de categorias na web:
```dart
Future<void> ensureCategoryMappings(String userId) async {
  final mappings = await _categoryService.getCategoryMappings(userId);
  
  if (mappings.isEmpty) {
    // Inicializar categorias padrão
    await _categoryService.initializeCategoryMappings(userId);
  }
}
```

---

## 📞 Suporte

Se tiver dúvidas sobre a implementação:
1. Verifique o código da web em `components/CategoryManager.tsx`
2. Verifique as funções do Firebase em `services/database.ts` (linhas 3550-3700)
3. Consulte a estrutura de dados em `types.ts` (interface `CategoryMapping`)

---

## 🚀 Próximos Passos

1. Implemente a versão básica (apenas leitura) primeiro
2. Teste a sincronização editando na web
3. Se necessário, implemente a tela de edição no app
4. Teste a sincronização bidirecional

Boa sorte com a implementação! 🎉
