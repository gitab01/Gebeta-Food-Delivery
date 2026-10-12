import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * The cart only holds menu ids and quantities. Prices come from the server at
 * checkout, so a stale client copy can never quote a wrong total.
 */
const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [restaurantId, setRestaurantId] = useState(null);
  const [lines, setLines] = useState([]);

  const reset = useCallback(() => {
    setRestaurantId(null);
    setLines([]);
  }, []);

  const add = useCallback(
    (restaurant, item) => {
      if (restaurantId && restaurantId !== restaurant.id) reset();
      setRestaurantId(restaurant.id);
      setLines((current) => {
        const found = current.find((l) => l.menuItemId === item.id);
        if (found) {
          return current.map((l) => (l.menuItemId === item.id ? { ...l, qty: Math.min(20, l.qty + 1) } : l));
        }
        return [...current, { menuItemId: item.id, name: item.name, emoji: item.emoji, unitPriceCents: item.priceCents, qty: 1 }];
      });
    },
    [restaurantId, reset]
  );

  const setQty = useCallback((menuItemId, qty) => {
    setLines((current) =>
      qty <= 0
        ? current.filter((l) => l.menuItemId !== menuItemId)
        : current.map((l) => (l.menuItemId === menuItemId ? { ...l, qty: Math.min(20, qty) } : l))
    );
  }, []);

  const subtotalCents = useMemo(
    () => lines.reduce((sum, l) => sum + l.unitPriceCents * l.qty, 0),
    [lines]
  );

  const count = useMemo(() => lines.reduce((n, l) => n + l.qty, 0), [lines]);

  const value = useMemo(
    () => ({ restaurantId, lines, count, subtotalCents, add, setQty, reset }),
    [restaurantId, lines, count, subtotalCents, add, setQty, reset]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
