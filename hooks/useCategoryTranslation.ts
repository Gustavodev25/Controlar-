import { useState, useEffect, useCallback, useMemo } from 'react';
import { CategoryMapping } from '../types';
import { listenToCategoryMappings, DEFAULT_CATEGORY_MAPPINGS } from '../services/database';
import { translatePluggyCategory } from '../services/openFinanceService';

/**
 * Hook para traduzir categorias usando os mapeamentos personalizados do usuário.
 * Se userId não for fornecido, usa apenas a tradução padrão do sistema.
 */
export const useCategoryTranslation = (userId?: string) => {
    const [categoryMappings, setCategoryMappings] = useState<CategoryMapping[]>(() => {
        // Inicializa com mappings padrão
        return DEFAULT_CATEGORY_MAPPINGS.map((cat) => ({
            ...cat,
            id: cat.originalKey.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        }));
    });
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
            if (mappings.length > 0) {
                setCategoryMappings(mappings);
            }
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

    return {
        translateCategory,
        categoryMappings,
        loading,
    };
};

export default useCategoryTranslation;
