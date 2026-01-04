import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { CategoryMapping } from '../types';
import { listenToCategoryMappings, DEFAULT_CATEGORY_MAPPINGS } from '../services/database';
import { translatePluggyCategory } from '../services/openFinanceService';

interface CategoryContextType {
    categoryMappings: CategoryMapping[];
    translateCategory: (originalCategory: string) => string;
    loading: boolean;
}

const CategoryContext = createContext<CategoryContextType>({
    categoryMappings: [],
    translateCategory: (cat) => translatePluggyCategory(cat),
    loading: true,
});

export const useCategoryContext = () => useContext(CategoryContext);

interface CategoryProviderProps {
    userId: string | null;
    children: React.ReactNode;
}

export const CategoryProvider: React.FC<CategoryProviderProps> = ({ userId, children }) => {
    const [categoryMappings, setCategoryMappings] = useState<CategoryMapping[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) {
            // Sem usuário, usa mapeamentos padrão
            setCategoryMappings(DEFAULT_CATEGORY_MAPPINGS.map((cat) => ({
                ...cat,
                id: cat.originalKey.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            })));
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsubscribe = listenToCategoryMappings(userId, (mappings) => {
            setCategoryMappings(mappings);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId]);

    // Cria um mapa para busca rápida por originalKey
    const categoryMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const cat of categoryMappings) {
            map.set(cat.originalKey.toLowerCase(), cat.displayName);
        }
        return map;
    }, [categoryMappings]);

    // Função que traduz categoria usando mapeamento do usuário
    const translateCategory = useCallback((originalCategory: string): string => {
        if (!originalCategory) return 'Outros';

        const key = originalCategory.toLowerCase();
        const userMapping = categoryMap.get(key);

        if (userMapping) {
            return userMapping;
        }

        // Fallback para tradução padrão do sistema
        return translatePluggyCategory(originalCategory);
    }, [categoryMap]);

    const value = useMemo(() => ({
        categoryMappings,
        translateCategory,
        loading,
    }), [categoryMappings, translateCategory, loading]);

    return (
        <CategoryContext.Provider value={value}>
            {children}
        </CategoryContext.Provider>
    );
};

export default CategoryContext;
