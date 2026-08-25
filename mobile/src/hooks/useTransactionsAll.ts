// Filtrlangan tranzaksiyalarning TO'LIQ to'plamini bosqichma-bosqich yuklaydi.
// Kategoriya kesimi (jami/soni) butun to'plam ustida hisoblanadi, shuning uchun
// sahifalar avtomatik ketma-ket olinadi. Xavfsizlik chegarasi: 20 sahifa (2000 yozuv).
import { useEffect, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchTransactions } from '../api/transactions';
import type { TransactionFilters, TransactionDTO, TransactionTotals } from '../api/types';

const SAHIFA_HAJMI = 100;
const MAKS_SAHIFA = 20;

export function useTransactionsAll(filters: Omit<TransactionFilters, 'page' | 'pageSize'>, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: ['transactions-all', filters],
    queryFn: ({ pageParam }) =>
      fetchTransactions({ ...filters, page: pageParam, pageSize: SAHIFA_HAJMI }),
    initialPageParam: 1,
    getNextPageParam: (last) => {
      const yuklangan = last.page * last.pageSize;
      if (yuklangan >= last.total) return undefined;
      if (last.page >= MAKS_SAHIFA) return undefined;
      return last.page + 1;
    },
    enabled,
  });

  // Barcha sahifalarni avtomatik olib kelamiz (kategoriya jamlari to'liq bo'lishi uchun)
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = query;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  const items: TransactionDTO[] = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data]
  );

  const totals: TransactionTotals | undefined = query.data?.pages[0]?.totals;
  const jamiSoni = query.data?.pages[0]?.total ?? 0;
  const toliq = !query.hasNextPage && !query.isPending;
  const kesildi = jamiSoni > MAKS_SAHIFA * SAHIFA_HAJMI;

  return { ...query, items, totals, jamiSoni, toliq, kesildi };
}
