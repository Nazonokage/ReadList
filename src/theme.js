export const THEME = {
  colors: {
    bg: '#0F0E11', // Deep velvety obsidian library
    bgCard: '#18171C', // Warm slate card
    bgCardElevated: '#222027', // Raised shelf element
    bgHighlight: '#2D2A35',
    border: '#2C2933',
    borderLight: '#3D3947',
    
    // Luxury Library Accents
    gold: '#F59E0B',
    goldLight: '#FDE68A',
    woodShelf: '#3E2723',
    woodShelfDark: '#271714',
    shelfTrim: '#8D6E63',
    
    // Status badges
    statusReading: '#3B82F6',
    statusCompleted: '#10B981',
    statusWant: '#F59E0B',
    statusOwned: '#8B5CF6', // Purple for Owned / Downloaded
    statusUpcoming: '#EC4899', // Pink for Upcoming / Anticipated
    statusDNF: '#EF4444',
    
    // Spicy ratings
    spicyActive: '#EF4444',
    spicyInactive: '#3F3F46',
    
    // Text hierarchy
    textPrimary: '#F4F4F6',
    textSecondary: '#A1A1AA',
    textTertiary: '#71717A',
    textGold: '#FCD34D',
    
    // Accents
    accentEmerald: '#10B981',
    accentRose: '#F43F5E',
    accentIndigo: '#6366F1'
  },
  
  springs: {
    // Apple fluid spring defaults
    tactilePress: {
      tension: 300,
      friction: 20,
      useNativeDriver: true
    },
    modalSlide: {
      tension: 180,
      friction: 22,
      useNativeDriver: true
    },
    cardSnap: {
      tension: 220,
      friction: 18,
      useNativeDriver: true
    },
    filterBounce: {
      tension: 260,
      friction: 16,
      useNativeDriver: true
    }
  },
  
  shadows: {
    bookSpine: {
      shadowColor: '#000',
      shadowOffset: { width: 4, height: 6 },
      shadowOpacity: 0.45,
      shadowRadius: 8,
      elevation: 7
    },
    cardElevated: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 14,
      elevation: 8
    },
    glowGold: {
      shadowColor: '#F59E0B',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 5
    }
  }
};
