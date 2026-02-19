# ⚛️ Exemplo de Implementação em React Native

## 📋 Caso o App seja React Native

Se o seu app mobile for em React Native, use este guia ao invés do Flutter.

---

## 🚀 Implementação Completa

### 1. Instalar Dependências

```bash
npm install @react-native-firebase/firestore
# ou
yarn add @react-native-firebase/firestore
```

### 2. Criar Serviço de Mapeamento

```typescript
// services/CategoryMappingService.ts
import firestore from '@react-native-firebase/firestore';

export interface CategoryMapping {
  id: string;
  originalKey: string;
  displayName: string;
  isDefault: boolean;
  group?: string;
  icon?: string;
  color?: string;
  updatedAt?: string;
}

class CategoryMappingService {
  private categoryCache: Map<string, string> = new Map();

  // Escutar mudanças em tempo real
  listenToCategoryMappings(
    userId: string,
    callback: (mappings: Map<string, string>) => void
  ) {
    return firestore()
      .collection('users')
      .doc(userId)
      .collection('categoryMappings')
      .onSnapshot((snapshot) => {
        const mappings = new Map<string, string>();
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          const originalKey = data.originalKey.toLowerCase();
          mappings.set(originalKey, data.displayName);
        });
        
        this.categoryCache = mappings;
        callback(mappings);
      });
  }

  // Carregar mapeamentos uma vez
  async loadCategoryMappings(userId: string): Promise<Map<string, string>> {
    try {
      const snapshot = await firestore()
        .collection('users')
        .doc(userId)
        .collection('categoryMappings')
        .get();
      
      const mappings = new Map<string, string>();
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const originalKey = data.originalKey.toLowerCase();
        mappings.set(originalKey, data.displayName);
      });
      
      this.categoryCache = mappings;
      return mappings;
    } catch (error) {
      console.error('Erro ao carregar mapeamentos:', error);
      return new Map();
    }
  }

  // Aplicar mapeamento em uma categoria
  getDisplayName(originalCategory: string): string {
    if (!originalCategory) return originalCategory;
    
    const key = originalCategory.toLowerCase();
    return this.categoryCache.get(key) || originalCategory;
  }

  // Criar categoria customizada
  async createCustomCategory(
    userId: string,
    displayName: string,
    group: string
  ): Promise<string> {
    try {
      const docRef = firestore()
        .collection('users')
        .doc(userId)
        .collection('categoryMappings')
        .doc();
      
      const id = docRef.id;
      const originalKey = `custom_${id}`;
      
      await docRef.set({
        originalKey,
        displayName,
        isDefault: false,
        group,
        updatedAt: new Date().toISOString(),
      });
      
      return id;
    } catch (error) {
      console.error('Erro ao criar categoria:', error);
      throw error;
    }
  }

  // Atualizar categoria
  async updateCategoryMapping(
    userId: string,
    categoryId: string,
    displayName: string
  ): Promise<void> {
    try {
      await firestore()
        .collection('users')
        .doc(userId)
        .collection('categoryMappings')
        .doc(categoryId)
        .update({
          displayName,
          updatedAt: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Erro ao atualizar categoria:', error);
      throw error;
    }
  }

  // Deletar categoria customizada
  async deleteCategoryMapping(
    userId: string,
    categoryId: string
  ): Promise<void> {
    try {
      await firestore()
        .collection('users')
        .doc(userId)
        .collection('categoryMappings')
        .doc(categoryId)
        .delete();
    } catch (error) {
      console.error('Erro ao deletar categoria:', error);
      throw error;
    }
  }
}

export default new CategoryMappingService();
```

### 3. Criar Context/Provider

```typescript
// contexts/TransactionContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import firestore from '@react-native-firebase/firestore';
import CategoryMappingService from '../services/CategoryMappingService';

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  categoryDisplay?: string;
  type: 'income' | 'expense';
  date: string;
  status: 'completed' | 'pending';
}

interface TransactionContextData {
  transactions: Transaction[];
  loading: boolean;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  updateTransaction: (transaction: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
}

const TransactionContext = createContext<TransactionContextData>(
  {} as TransactionContextData
);

export const TransactionProvider: React.FC<{ userId: string; children: React.ReactNode }> = ({
  userId,
  children,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categoryMappings, setCategoryMappings] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  // Listener para transações
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = firestore()
      .collection('users')
      .doc(userId)
      .collection('transactions')
      .onSnapshot((snapshot) => {
        const txs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Transaction[];
        
        // Aplica mapeamentos
        const mappedTxs = applyMappings(txs, categoryMappings);
        setTransactions(mappedTxs);
        setLoading(false);
      });

    return () => unsubscribe();
  }, [userId, categoryMappings]);

  // Listener para mapeamentos de categorias
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = CategoryMappingService.listenToCategoryMappings(
      userId,
      (mappings) => {
        setCategoryMappings(mappings);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  // Aplicar mapeamentos nas transações
  const applyMappings = (
    txs: Transaction[],
    mappings: Map<string, string>
  ): Transaction[] => {
    return txs.map((tx) => {
      const key = tx.category.toLowerCase();
      const displayName = mappings.get(key) || tx.category;
      
      return {
        ...tx,
        categoryDisplay: displayName,
      };
    });
  };

  // Adicionar transação
  const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
    try {
      await firestore()
        .collection('users')
        .doc(userId)
        .collection('transactions')
        .add({
          ...transaction,
          // Remove categoryDisplay antes de salvar
          categoryDisplay: undefined,
        });
    } catch (error) {
      console.error('Erro ao adicionar transação:', error);
      throw error;
    }
  };

  // Atualizar transação
  const updateTransaction = async (transaction: Transaction) => {
    try {
      const { id, categoryDisplay, ...data } = transaction;
      
      await firestore()
        .collection('users')
        .doc(userId)
        .collection('transactions')
        .doc(id)
        .update(data);
    } catch (error) {
      console.error('Erro ao atualizar transação:', error);
      throw error;
    }
  };

  // Deletar transação
  const deleteTransaction = async (id: string) => {
    try {
      await firestore()
        .collection('users')
        .doc(userId)
        .collection('transactions')
        .doc(id)
        .delete();
    } catch (error) {
      console.error('Erro ao deletar transação:', error);
      throw error;
    }
  };

  return (
    <TransactionContext.Provider
      value={{
        transactions,
        loading,
        addTransaction,
        updateTransaction,
        deleteTransaction,
      }}
    >
      {children}
    </TransactionContext.Provider>
  );
};

export const useTransactions = () => {
  const context = useContext(TransactionContext);
  
  if (!context) {
    throw new Error('useTransactions must be used within TransactionProvider');
  }
  
  return context;
};
```

### 4. Usar no App

```typescript
// App.tsx
import React from 'react';
import { TransactionProvider } from './contexts/TransactionContext';

const App = () => {
  const userId = 'user123'; // Pegar do auth

  return (
    <TransactionProvider userId={userId}>
      <MainNavigator />
    </TransactionProvider>
  );
};

export default App;
```

### 5. Componente de Lista de Transações

```typescript
// screens/TransactionListScreen.tsx
import React from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useTransactions } from '../contexts/TransactionContext';

const TransactionListScreen = () => {
  const { transactions, loading } = useTransactions();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#d97757" />
      </View>
    );
  }

  return (
    <FlatList
      data={transactions}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.transactionCard}>
          <View style={styles.transactionInfo}>
            <Text style={styles.description}>{item.description}</Text>
            <Text style={styles.category}>
              {item.categoryDisplay || item.category}
            </Text>
          </View>
          <Text
            style={[
              styles.amount,
              item.type === 'income' ? styles.income : styles.expense,
            ]}
          >
            R$ {item.amount.toFixed(2)}
          </Text>
        </View>
      )}
      contentContainerStyle={styles.list}
    />
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
  },
  transactionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#30302E',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#373734',
  },
  transactionInfo: {
    flex: 1,
  },
  description: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  category: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  amount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  income: {
    color: '#10B981',
  },
  expense: {
    color: '#EF4444',
  },
});

export default TransactionListScreen;
```

### 6. Tela de Gestão de Categorias (Opcional)

```typescript
// screens/CategoryManagementScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import CategoryMappingService, { CategoryMapping } from '../services/CategoryMappingService';

interface Props {
  userId: string;
}

const CategoryManagementScreen: React.FC<Props> = ({ userId }) => {
  const [categories, setCategories] = useState<CategoryMapping[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = firestore()
      .collection('users')
      .doc(userId)
      .collection('categoryMappings')
      .onSnapshot((snapshot) => {
        const cats = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as CategoryMapping[];
        
        setCategories(cats);
        setLoading(false);
      });

    return () => unsubscribe();
  }, [userId]);

  const handleEdit = (category: CategoryMapping) => {
    Alert.prompt(
      'Editar Categoria',
      'Digite o novo nome:',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salvar',
          onPress: async (newName) => {
            if (newName) {
              try {
                await CategoryMappingService.updateCategoryMapping(
                  userId,
                  category.id,
                  newName
                );
              } catch (error) {
                Alert.alert('Erro', 'Não foi possível atualizar a categoria');
              }
            }
          },
        },
      ],
      'plain-text',
      category.displayName
    );
  };

  const handleDelete = (category: CategoryMapping) => {
    if (category.isDefault) {
      Alert.alert('Atenção', 'Não é possível deletar categorias padrão');
      return;
    }

    Alert.alert(
      'Confirmar Exclusão',
      `Deseja excluir "${category.displayName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await CategoryMappingService.deleteCategoryMapping(
                userId,
                category.id
              );
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível deletar a categoria');
            }
          },
        },
      ]
    );
  };

  const handleCreate = () => {
    Alert.prompt(
      'Nova Categoria',
      'Digite o nome da categoria:',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Criar',
          onPress: async (name) => {
            if (name) {
              try {
                await CategoryMappingService.createCustomCategory(
                  userId,
                  name,
                  'Outros'
                );
              } catch (error) {
                Alert.alert('Erro', 'Não foi possível criar a categoria');
              }
            }
          },
        },
      ],
      'plain-text'
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gestão de Categorias</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleCreate}>
          <Text style={styles.addButtonText}>+ Nova</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.categoryCard}>
            <View style={styles.categoryInfo}>
              <Text style={styles.displayName}>{item.displayName}</Text>
              <Text style={styles.originalKey}>{item.originalKey}</Text>
              {!item.isDefault && (
                <Text style={styles.customBadge}>Customizada</Text>
              )}
            </View>
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => handleEdit(item)}
              >
                <Text style={styles.editButtonText}>Editar</Text>
              </TouchableOpacity>
              {!item.isDefault && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDelete(item)}
                >
                  <Text style={styles.deleteButtonText}>Excluir</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1F1F1D',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#373734',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  addButton: {
    backgroundColor: '#d97757',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  list: {
    padding: 16,
  },
  categoryCard: {
    backgroundColor: '#30302E',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#373734',
  },
  categoryInfo: {
    marginBottom: 12,
  },
  displayName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  originalKey: {
    fontSize: 14,
    color: '#9CA3AF',
    fontFamily: 'monospace',
  },
  customBadge: {
    fontSize: 12,
    color: '#d97757',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  deleteButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});

export default CategoryManagementScreen;
```

---

## 🔄 Fluxo de Sincronização

### Editar na Web → Ver no App
```typescript
1. Web: Usuário muda "groceries" → "Supermercado"
2. Firestore: categoryMappings/groceries atualizado
3. App: onSnapshot detecta mudança
4. App: setCategoryMappings atualizado
5. App: Transações reaplicam mapeamento
6. App: UI atualiza automaticamente
7. ✅ Sincronizado!
```

### Criar Transação no App → Ver na Web
```typescript
1. App: addTransaction({ category: "groceries" })
2. Firestore: transactions/{id} criado
3. App: onSnapshot detecta nova transação
4. App: Aplica mapeamento (groceries → Supermercado)
5. Web: Listener detecta nova transação
6. Web: Aplica mapeamento
7. ✅ Sincronizado!
```

---

## ✅ Checklist

- [ ] Instalar `@react-native-firebase/firestore`
- [ ] Criar `CategoryMappingService`
- [ ] Criar `TransactionContext`
- [ ] Adicionar `TransactionProvider` no App
- [ ] Usar `useTransactions` nos componentes
- [ ] Testar: editar na web e ver no app
- [ ] (Opcional) Criar tela de gestão de categorias

---

## 🎯 Resultado Final

Após implementar, você terá:
- ✅ Sincronização automática entre web e app
- ✅ Categorias personalizadas aparecem em tempo real
- ✅ Mudanças na web refletem no app instantaneamente
- ✅ Mudanças no app refletem na web instantaneamente

---

## 📞 Suporte

Para mais detalhes, consulte:
- **[SINCRONIZACAO_CATEGORIAS_TRANSACOES.md](./SINCRONIZACAO_CATEGORIAS_TRANSACOES.md)** - Guia completo
- **[GUIA_RAPIDO_SINCRONIZACAO.md](./GUIA_RAPIDO_SINCRONIZACAO.md)** - Passo a passo simplificado

Boa sorte! 🚀
