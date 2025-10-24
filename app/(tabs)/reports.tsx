import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { TrendingUp, TrendingDown, Calendar, PieChart } from 'lucide-react-native';

interface CategorySpending {
  category: string;
  amount: number;
  color: string;
  percentage: number;
}

interface MonthlyData {
  month: string;
  income: number;
  expense: number;
}

export default function ReportsScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [categorySpending, setCategorySpending] = useState<CategorySpending[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);

  useEffect(() => {
    fetchReportData();
  }, [selectedPeriod]);

  const getDateRange = () => {
    const currentDate = new Date();
    let startDate: Date;

    if (selectedPeriod === 'week') {
      startDate = new Date(currentDate);
      startDate.setDate(currentDate.getDate() - 7);
    } else if (selectedPeriod === 'month') {
      startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    } else {
      startDate = new Date(currentDate.getFullYear(), 0, 1);
    }

    return { startDate, endDate: currentDate };
  };

  const fetchReportData = async () => {
    const { startDate, endDate } = getDateRange();

    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, type, category:categories(name, color)')
      .eq('user_id', user?.id)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0]);

    if (transactions) {
      const income = transactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const expense = transactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      setTotalIncome(income);
      setTotalExpense(expense);

      const categoryMap: { [key: string]: { amount: number; color: string } } = {};
      transactions
        .filter((t) => t.type === 'expense' && t.category)
        .forEach((t) => {
          const catName = t.category?.name || 'Uncategorized';
          if (!categoryMap[catName]) {
            categoryMap[catName] = {
              amount: 0,
              color: t.category?.color || '#6B7280',
            };
          }
          categoryMap[catName].amount += Number(t.amount);
        });

      const categoryArray = Object.keys(categoryMap)
        .map((category) => ({
          category,
          amount: categoryMap[category].amount,
          color: categoryMap[category].color,
          percentage: expense > 0 ? (categoryMap[category].amount / expense) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      setCategorySpending(categoryArray);
    }

    if (selectedPeriod === 'year') {
      const monthlyMap: { [key: string]: { income: number; expense: number } } = {};

      const yearStart = new Date(new Date().getFullYear(), 0, 1);
      const { data: yearTransactions } = await supabase
        .from('transactions')
        .select('amount, type, date')
        .eq('user_id', user?.id)
        .gte('date', yearStart.toISOString().split('T')[0]);

      yearTransactions?.forEach((t) => {
        const month = new Date(t.date).toLocaleDateString('en-US', { month: 'short' });
        if (!monthlyMap[month]) {
          monthlyMap[month] = { income: 0, expense: 0 };
        }
        if (t.type === 'income') {
          monthlyMap[month].income += Number(t.amount);
        } else {
          monthlyMap[month].expense += Number(t.amount);
        }
      });

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyArray = months.map((month) => ({
        month,
        income: monthlyMap[month]?.income || 0,
        expense: monthlyMap[month]?.expense || 0,
      }));

      setMonthlyData(monthlyArray);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  const netAmount = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? ((netAmount / totalIncome) * 100).toFixed(1) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reports</Text>
      </View>

      <View style={styles.periodSelector}>
        {(['week', 'month', 'year'] as const).map((period) => (
          <TouchableOpacity
            key={period}
            style={[styles.periodButton, selectedPeriod === period && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod(period)}
          >
            <Text style={[styles.periodButtonText, selectedPeriod === period && styles.periodButtonTextActive]}>
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <View style={styles.summaryIconContainer}>
                <TrendingUp size={24} color="#10B981" />
              </View>
              <Text style={styles.summaryLabel}>Income</Text>
              <Text style={styles.summaryAmount}>${totalIncome.toFixed(2)}</Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryItem}>
              <View style={styles.summaryIconContainer}>
                <TrendingDown size={24} color="#EF4444" />
              </View>
              <Text style={styles.summaryLabel}>Expenses</Text>
              <Text style={styles.summaryAmount}>${totalExpense.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.netAmountContainer}>
            <Text style={styles.netAmountLabel}>Net Balance</Text>
            <Text style={[styles.netAmount, netAmount >= 0 ? styles.positiveAmount : styles.negativeAmount]}>
              {netAmount >= 0 ? '+' : ''}${netAmount.toFixed(2)}
            </Text>
            <Text style={styles.savingsRate}>Savings Rate: {savingsRate}%</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <PieChart size={20} color="#111827" />
            <Text style={styles.sectionTitle}>Spending by Category</Text>
          </View>

          {categorySpending.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No expense data for this period</Text>
            </View>
          ) : (
            <View style={styles.categoryList}>
              {categorySpending.map((item, index) => (
                <View key={index} style={styles.categoryItem}>
                  <View style={styles.categoryInfo}>
                    <View style={[styles.categoryDot, { backgroundColor: item.color }]} />
                    <Text style={styles.categoryName}>{item.category}</Text>
                  </View>
                  <View style={styles.categoryAmount}>
                    <Text style={styles.categoryValue}>${item.amount.toFixed(2)}</Text>
                    <Text style={styles.categoryPercentage}>{item.percentage.toFixed(1)}%</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {selectedPeriod === 'year' && monthlyData.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Calendar size={20} color="#111827" />
              <Text style={styles.sectionTitle}>Monthly Overview</Text>
            </View>

            <View style={styles.monthlyList}>
              {monthlyData.map((item, index) => (
                <View key={index} style={styles.monthlyItem}>
                  <Text style={styles.monthLabel}>{item.month}</Text>
                  <View style={styles.monthlyBars}>
                    <View style={styles.monthlyBar}>
                      <View
                        style={[
                          styles.monthlyBarFill,
                          {
                            backgroundColor: '#10B981',
                            width: `${Math.min((item.income / Math.max(totalIncome / 12, 1)) * 100, 100)}%`,
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.monthlyBar}>
                      <View
                        style={[
                          styles.monthlyBarFill,
                          {
                            backgroundColor: '#EF4444',
                            width: `${Math.min((item.expense / Math.max(totalExpense / 12, 1)) * 100, 100)}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>
                  <View style={styles.monthlyValues}>
                    <Text style={styles.incomeValue}>${item.income.toFixed(0)}</Text>
                    <Text style={styles.expenseValue}>${item.expense.toFixed(0)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111827',
  },
  periodSelector: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  periodButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FFF',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  periodButtonActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  periodButtonTextActive: {
    color: '#FFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  summaryCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
  },
  netAmountContainer: {
    alignItems: 'center',
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  netAmountLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  netAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  positiveAmount: {
    color: '#10B981',
  },
  negativeAmount: {
    color: '#EF4444',
  },
  savingsRate: {
    fontSize: 14,
    color: '#6B7280',
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  categoryList: {
    gap: 12,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  categoryName: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  categoryAmount: {
    alignItems: 'flex-end',
  },
  categoryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  categoryPercentage: {
    fontSize: 12,
    color: '#6B7280',
  },
  monthlyList: {
    gap: 16,
  },
  monthlyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  monthLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    width: 30,
  },
  monthlyBars: {
    flex: 1,
    gap: 4,
  },
  monthlyBar: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  monthlyBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  monthlyValues: {
    gap: 4,
    width: 60,
    alignItems: 'flex-end',
  },
  incomeValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
  },
  expenseValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
  },
});
