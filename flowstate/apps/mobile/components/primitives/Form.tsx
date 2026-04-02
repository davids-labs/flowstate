import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { AppText } from './Text';
import { useTheme } from '../../constants/ThemeContext';
import { radius, space } from '../../constants/theme';

interface FormTextFieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string | null;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  titleField?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

interface FormSectionProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

interface FormChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function FormSection({
  eyebrow,
  title,
  description,
  children,
  style,
}: FormSectionProps) {
  const { themeTokens } = useTheme();

  return (
    <View style={[styles.section, style]}>
      {eyebrow ? (
        <AppText variant="caption1" color={themeTokens.textTertiary} style={styles.eyebrow}>
          {eyebrow}
        </AppText>
      ) : null}
      {title ? (
        <AppText variant="headline" style={styles.sectionTitle}>
          {title}
        </AppText>
      ) : null}
      {description ? (
        <AppText variant="footnote" color={themeTokens.textSecondary}>
          {description}
        </AppText>
      ) : null}
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

export function FormTextField({
  label,
  hint,
  error,
  leading,
  trailing,
  titleField = false,
  multiline,
  containerStyle,
  inputStyle,
  onFocus,
  onBlur,
  autoCorrect,
  spellCheck,
  autoComplete,
  importantForAutofill,
  ...props
}: FormTextFieldProps) {
  const { themeTokens } = useTheme();
  const [focused, setFocused] = useState(false);

  // Avoid toggling shadow styles on focus; Fabric can blur TextInput when wrapper shadows change.
  const shellStyle = useMemo(
    () => ({
      backgroundColor: themeTokens.surfaceInput,
      borderColor: error
        ? themeTokens.destructive
        : focused
        ? themeTokens.accent
        : themeTokens.border,
    }),
    [error, focused, themeTokens],
  );

  return (
    <View style={[styles.fieldGroup, containerStyle]}>
      {label ? (
        <AppText variant="caption1" color={themeTokens.textTertiary} style={styles.fieldLabel}>
          {label}
        </AppText>
      ) : null}
      <View style={[styles.fieldShell, shellStyle, multiline ? styles.fieldShellTall : null]}>
        {leading ? <View style={styles.leading}>{leading}</View> : null}
        <TextInput
          {...props}
          multiline={multiline}
          style={[
            styles.fieldInput,
            titleField ? styles.titleInput : null,
            multiline ? styles.multilineInput : null,
            { color: themeTokens.textPrimary },
            inputStyle,
          ]}
          placeholderTextColor={themeTokens.textPlaceholder}
          selectionColor={themeTokens.accent}
          cursorColor={themeTokens.accent}
          underlineColorAndroid="transparent"
          autoCorrect={titleField ? false : autoCorrect}
          spellCheck={titleField ? false : spellCheck}
          autoComplete={titleField ? 'off' : autoComplete}
          importantForAutofill={titleField ? 'no' : importantForAutofill}
          textAlignVertical={Platform.OS === 'android' && multiline ? 'top' : undefined}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
        />
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
      {error ? (
        <AppText variant="caption1" color={themeTokens.destructive}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption1" color={themeTokens.textSecondary}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function FormChip({
  label,
  selected = false,
  onPress,
  accentColor,
  style,
}: FormChipProps) {
  const { themeTokens } = useTheme();
  const activeColor = accentColor ?? themeTokens.accent;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? `${activeColor}18` : themeTokens.surface,
          borderColor: selected ? activeColor : themeTokens.border,
        },
        style,
      ]}
    >
      <AppText
        variant="footnote"
        color={selected ? activeColor : themeTokens.textSecondary}
        style={styles.chipLabel}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export function FormCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { themeTokens } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: themeTokens.surfaceElevated,
          borderColor: themeTokens.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: space[8],
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionTitle: {
    fontWeight: '700',
  },
  sectionContent: {
    gap: space[12],
  },
  fieldGroup: {
    gap: space[8],
  },
  fieldLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  fieldShell: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space[16],
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldShellTall: {
    alignItems: 'flex-start',
    paddingVertical: space[12],
  },
  fieldInput: {
    flex: 1,
    fontSize: 17,
    minHeight: Platform.OS === 'android' ? 24 : undefined,
    paddingVertical: Platform.OS === 'android' ? 10 : 0,
  },
  titleInput: {
    fontSize: 24,
    lineHeight: Platform.OS === 'ios' ? 30 : undefined,
    fontWeight: Platform.OS === 'android' ? '600' : '700',
    paddingVertical: Platform.OS === 'android' ? 6 : 0,
  },
  multilineInput: {
    minHeight: 88,
    paddingTop: Platform.OS === 'android' ? 2 : 0,
    paddingBottom: Platform.OS === 'android' ? 6 : 4,
  },
  leading: {
    marginRight: space[12],
  },
  trailing: {
    marginLeft: space[12],
  },
  chip: {
    minHeight: 38,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: space[12],
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipLabel: {
    fontWeight: '600',
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space[16],
  },
});
