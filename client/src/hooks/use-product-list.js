
import { useEffect, useState } from "react";
import { loadProductListing } from "../services/storefront-service.js";

export function useProductList(filters) {
  const [data, setData] = useState({
    products: [],
    categories: [],
    brands: [],
    pagination: {
      page: 1,
      page_size: 12,
      total_items: 0,
      total_pages: 0,
    },
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const result = await loadProductListing(filters);

        if (live) {
          setData(result);
        }
      } catch (err) {
        if (live) {
          setError(err);
        }
      } finally {
        if (live) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      live = false;
    };
  }, [
    filters.keyword,
    filters.category_id,
    filters.brand_id,
    filters.min_price,
    filters.max_price,
    filters.warranty_months,
    filters.sort,
    filters.page,
    filters.page_size,
  ]);

  return { ...data, loading, error };
}
