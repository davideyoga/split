import {
  bagHandleOutline,
  bedOutline,
  busOutline,
  carOutline,
  cartOutline,
  fastFoodOutline,
  medkitOutline,
  pricetagOutline,
  restaurantOutline,
  ticketOutline,
} from 'ionicons/icons';

export interface Category {
  publicId: string;
  // Solo per le preconfigurate: il nome visibile si ottiene traducendo
  // `categories.<slug>`. Le categorie custom hanno slug null e name valorizzato.
  slug: string | null;
  name: string | null;
  icon: string;
  color: string | null;
  isCustom: boolean;
}

// Categoria come arriva dentro una spesa (senza isCustom): la label si
// risolve sempre con "name se c'è, altrimenti traduci lo slug".
export type ExpenseCategory = Omit<Category, 'isCustom'>;

// Icone usate dalle categorie preconfigurate (vedi splitBack/prisma/seed.ts).
// Vanno passate ad addIcons() in ogni pagina che mostra una categoria, perché
// il nome dell'icona arriva dal DB e non è scritto nel template.
export const CATEGORY_ICONS: Record<string, string> = {
  'fast-food-outline': fastFoodOutline,
  'restaurant-outline': restaurantOutline,
  'cart-outline': cartOutline,
  'bus-outline': busOutline,
  'car-outline': carOutline,
  'bed-outline': bedOutline,
  'ticket-outline': ticketOutline,
  'bag-handle-outline': bagHandleOutline,
  'medkit-outline': medkitOutline,
  'pricetag-outline': pricetagOutline,
};

// Icona di default delle categorie custom (uguale al default lato Prisma).
export const DEFAULT_CATEGORY_ICON = 'pricetag-outline';
