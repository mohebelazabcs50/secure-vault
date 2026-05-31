import { create } from 'zustand';

export interface VaultItem {
  id: string;
  websiteName: string;
  url: string;
  username: string;
  email: string;
  password?: string;
  notes: string | null;
  category: 'Social Media' | 'Banking' | 'Work' | 'Gaming' | 'Shopping' | 'Crypto';
  securityScore: number; // 0 to 100
  createdAt: string;
  updatedAt: string;
  isLeaked?: boolean; // Pwned cache
}

interface VaultState {
  items: VaultItem[];
  searchQuery: string;
  selectedCategory: string; // 'All' or specific category
  sortBy: 'website' | 'score' | 'date';
  
  setItems: (items: VaultItem[]) => void;
  addItem: (item: VaultItem) => void;
  updateItem: (id: string, updated: Partial<VaultItem>) => void;
  deleteItem: (id: string) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string) => void;
  setSortBy: (sort: 'website' | 'score' | 'date') => void;
  
  // Stats selectors
  getStats: () => {
    total: number;
    strong: number;
    weak: number;
    leaked: number;
  };
}

export const useVaultStore = create<VaultState>((set, get) => ({
  items: [],
  searchQuery: '',
  selectedCategory: 'All',
  sortBy: 'website',

  setItems: (items) => set({ items }),
  
  addItem: (item) => set((state) => ({ items: [item, ...state.items] })),
  
  updateItem: (id, updated) => set((state) => ({
    items: state.items.map((item) => item.id === id ? { ...item, ...updated } : item),
  })),
  
  deleteItem: (id) => set((state) => ({
    items: state.items.filter((item) => item.id !== id),
  })),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),

  setSortBy: (sortBy) => set({ sortBy }),

  getStats: () => {
    const items = get().items;
    let strong = 0;
    let weak = 0;
    let leaked = 0;

    items.forEach((item) => {
      // Score: 0-2 Weak, 3 Fair/Good, 4 Strong
      // zxcvbn raw scores map to: 0-1 weak, 2 fair, 3 good, 4 strong
      // Let's assume securityScore is 0-100.
      // Score < 40: Weak, Score >= 80: Strong
      if (item.securityScore >= 75) strong++;
      if (item.securityScore < 40) weak++;
      if (item.isLeaked) leaked++;
    });

    return {
      total: items.length,
      strong,
      weak,
      leaked,
    };
  },
}));
