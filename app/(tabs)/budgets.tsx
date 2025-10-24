import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Plus, X, AlertCircle } from 'lucide-react-native';

interface Budget {
  id: string;
  amount: number;
  period: string;
  category: { id: string; name: string; color: string };
  spent: number;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

export default function BudgetsScreen() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchBudgets();
    fetchCategories();
  }, []);

  const fetchBudgets = async () => {
    const { data: budgetsData } = await supabase
      .from('budgets')
      .select('id, amount, period, category:categories(id, name, color)')
      .eq('user_id', user?.id);

    if (budgetsData) {
      const budgetsWithSpent = await Promise.all(
        budgetsData.map(async (budget) => {
          const currentDate = new Date();
          let startDate: Date;

          if (budget.period === 'weekly') {
            startDate = new Date(currentDate);
            startDate.setDate(currentDate.getDate() - currentDate.getDay());
          } else if (budget.period === 'monthly') {
            startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
          } else {
            startDate = new Date(currentDate.getFullYear(), 0, 1);
          }

          const { data: transactions } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', user?.id)
            .eq('category_id', budget.category.id)
            .eq('type', 'expense')
            .gte('date', startDate.toISOString().split('T')[0]);

          const spent = transactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

          return {
            ...budget,
            spent,
          };
        })
      );

      setBudgets(budgetsWithSpent);
    }
    setLoading(false);
  };

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('id, name, color')
      .eq('user_id', user?.id)
      .eq('type', 'expense');

    if (data) {
      setCategories(data);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBudgets();
    setRefreshing(false);
  };

  const handleAddBudget = async () => {
    if (!selectedCategory || !amount) return;

    setSaving(true);
    const { error } = await supabase.from('budgets').insert({
      user_id: user?.id,
      category_id: selectedCategory.id,
      amount: parseFloat(amount),
      period,
    });

    if (!error) {
      setShowAddModal(false);
      setSelectedCategory(null);
      setAmount('');
      setPeriod('monthly');
      fetchBudgets();
    }
    setSaving(false);
  };

  const handleDeleteBudget = async (budgetId: string) => {
    await supabase.from('budgets').delete().eq('id', budgetId);
    fetchBudgets();
  };

  const getProgressPercentage = (spent: number, budget: number) => {
    return Math.min((spent / budget) * 100, 100);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return '#EF4444';
    if (percentage >= 80) return '#F59E0B';
    return '#10B981';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Budgets</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
      >
        {budgets.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No budgets set</Text>
            <Text style={styles.emptySubtext}>Create a budget to track your spending</Text>
          </View>
        ) : (
          budgets.map((budget) => {
            const percentage = getProgressPercentage(budget.spent, budget.amount);
            const progressColor = getProgressColor(percentage);

            return (
              <View key={budget.id} style={styles.budgetCard}>
                <View style={styles.budgetHeader}>
                  <View style={styles.budgetInfo}>
                    <View style={[styles.categoryDot, { backgroundColor: budget.category.color }]} />
                    <View>
                      <Text style={styles.budgetCategory}>{budget.category.name}</Text>
                      <Text style={styles.budgetPeriod}>{budget.period}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteBudget(budget.id)}>
                    <X size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                <View style={styles.budgetAmount}>
                  <Text style={styles.spentAmount}>${budget.spent.toFixed(2)}</Text>
                  <Text style={styles.totalAmount}>of ${budget.amount.toFixed(2)}</Text>
                </View>

                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: progressColor }]} />
                </View>

                <View style={styles.budgetFooter}>
                  <Text style={[styles.percentageText, { color: progressColor }]}>{percentage.toFixed(0)}% used</Text>
                  {percentage >= 80 && (
                    <View style={styles.warningBadge}>
                      <AlertCircle size={14} color="#F59E0B" />
                      <Text style={styles.warningText}>
                        {percentage >= 100 ? 'Budget exceeded' : 'Almost there'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
        <Plus size={28} color="#FFF" />
      </TouchableOpacity>

      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Budget</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <X size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryList}>
                  {categories.map((category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categoryChip,
                        selectedCategory?.id === category.id && styles.categoryChipSelected,
                      ]}
                      onPress={() => setSelectedCategory(category)}
                    >
                      <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                      <Text
                        style={[
                          styles.categoryChipText,
                          selectedCategory?.id === category.id && styles.categoryChipTextSelected,
                        ]}
                      >
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Budget Amount</Text>
                <View style={styles.amountInput}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Period</Text>
                <View style={styles.periodSelector}>
                  {(['weekly', 'monthly', 'yearly'] as const).map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.periodButton, period === p && styles.periodButtonActive]}
                      onPress={() => setPeriod(p)}
                    >
                      <Text style={[styles.periodButtonText, period === p && styles.periodButtonTextActive]}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                onPress={handleAddBudget}
                disabled={saving || !selectedCategory || !amount}
              >
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Create Budget</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    padding: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },
  budgetCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  budgetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  budgetCategory: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  budgetPeriod: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  budgetAmount: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 12,
  },
  spentAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  totalAmount: {
    fontSize: 16,
    color: '#6B7280',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  budgetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  percentageText: {
    fontSize: 14,
    fontWeight: '600',
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  warningText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalBody: {
    padding: 24,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  categoryList: {
    flexDirection: 'row',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  categoryChipSelected: {
    backgroundColor: '#10B981',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  categoryChipTextSelected: {
    color: '#FFF',
  },
  amountInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '600',
    color: '#6B7280',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    paddingVertical: 16,
  },
  periodSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  periodButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#10B981',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  periodButtonTextActive: {
    color: '#FFF',
  },
  submitButton: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
