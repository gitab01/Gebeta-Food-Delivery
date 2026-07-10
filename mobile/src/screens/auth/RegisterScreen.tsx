import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { register, clearError } from '../../store/slices/authSlice';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';

const RegisterScreen = ({ navigation }: any) => {
  const dispatch = useDispatch<AppDispatch>();
  const { isLoading, error } = useSelector((state: RootState) => state.auth);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [role, setRole] = useState<'customer' | 'driver'>('customer');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Name is required';
    if (!form.email.trim()) newErrors.email = 'Email is required';
    if (!form.password || form.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = () => {
    if (!validate()) return;
    dispatch(register({ name: form.name, email: form.email, phone: form.phone, password: form.password, role }));
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Create account 🍽️</Text>
          <Text style={styles.subtitle}>Join Gebeta and start ordering</Text>

          {/* Role Selector */}
          <View style={styles.roleSelector}>
            {(['customer', 'driver'] as const).map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.roleBtn, role === r && styles.roleBtnActive]}
                onPress={() => setRole(r)}
              >
                <Text style={styles.roleIcon}>{r === 'customer' ? '🛍️' : '🚴'}</Text>
                <Text style={[styles.roleText, role === r && styles.roleTextActive]}>
                  {r === 'customer' ? 'Customer' : 'Driver'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* API Error */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Fields */}
          {[
            { key: 'name', label: 'Full Name', placeholder: 'Abebe Kebede', keyboardType: 'default', autoCapitalize: 'words' },
            { key: 'email', label: 'Email', placeholder: 'you@example.com', keyboardType: 'email-address', autoCapitalize: 'none' },
            { key: 'phone', label: 'Phone (optional)', placeholder: '+251 91 234 5678', keyboardType: 'phone-pad', autoCapitalize: 'none' },
          ].map((field) => (
            <View key={field.key} style={styles.fieldGroup}>
              <Text style={styles.label}>{field.label}</Text>
              <TextInput
                style={[styles.input, errors[field.key] && styles.inputError]}
                value={(form as any)[field.key]}
                onChangeText={(v) => updateField(field.key, v)}
                placeholder={field.placeholder}
                placeholderTextColor={COLORS.gray}
                keyboardType={field.keyboardType as any}
                autoCapitalize={field.autoCapitalize as any}
              />
              {errors[field.key] && <Text style={styles.fieldError}>{errors[field.key]}</Text>}
            </View>
          ))}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={[styles.input, errors.password && styles.inputError]}
              value={form.password}
              onChangeText={(v) => updateField('password', v)}
              placeholder="Min 6 characters"
              placeholderTextColor={COLORS.gray}
              secureTextEntry
            />
            {errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={[styles.input, errors.confirmPassword && styles.inputError]}
              value={form.confirmPassword}
              onChangeText={(v) => updateField('confirmPassword', v)}
              placeholder="Repeat password"
              placeholderTextColor={COLORS.gray}
              secureTextEntry
            />
            {errors.confirmPassword && <Text style={styles.fieldError}>{errors.confirmPassword}</Text>}
          </View>

          <TouchableOpacity
            style={[styles.registerBtn, isLoading && styles.disabledBtn]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.registerBtnText}>Create Account</Text>}
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, flexGrow: 1 },
  backBtn: { marginBottom: SPACING.lg },
  backText: { color: COLORS.primary, fontSize: FONTS.sizes.md, fontWeight: '600' },
  title: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text.primary, marginBottom: SPACING.xs },
  subtitle: { fontSize: FONTS.sizes.md, color: COLORS.text.secondary, marginBottom: SPACING.lg },
  roleSelector: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  roleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.xs, padding: SPACING.md, borderRadius: BORDER_RADIUS.md,
    borderWidth: 2, borderColor: COLORS.border, backgroundColor: COLORS.white,
  },
  roleBtnActive: { borderColor: COLORS.primary, backgroundColor: '#FFF5F2' },
  roleIcon: { fontSize: 20 },
  roleText: { fontWeight: '600', color: COLORS.text.secondary },
  roleTextActive: { color: COLORS.primary },
  errorBox: {
    backgroundColor: '#FFEBEE', borderRadius: BORDER_RADIUS.md, padding: SPACING.md,
    marginBottom: SPACING.md, borderLeftWidth: 4, borderLeftColor: COLORS.error,
  },
  errorText: { color: COLORS.error },
  fieldGroup: { marginBottom: SPACING.md },
  label: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.text.primary, marginBottom: SPACING.xs },
  input: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    fontSize: FONTS.sizes.md, color: COLORS.text.primary,
    borderWidth: 1, borderColor: COLORS.border,
  },
  inputError: { borderColor: COLORS.error },
  fieldError: { color: COLORS.error, fontSize: FONTS.sizes.xs, marginTop: SPACING.xs },
  registerBtn: {
    backgroundColor: COLORS.primary, paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.xl, alignItems: 'center', marginTop: SPACING.lg,
  },
  disabledBtn: { opacity: 0.7 },
  registerBtnText: { color: COLORS.white, fontSize: FONTS.sizes.lg, fontWeight: '700' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.lg, marginBottom: SPACING.xl },
  loginText: { fontSize: FONTS.sizes.md, color: COLORS.text.secondary },
  loginLink: { fontSize: FONTS.sizes.md, color: COLORS.primary, fontWeight: '700' },
});

export default RegisterScreen;
