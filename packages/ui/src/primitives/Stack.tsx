import { View, type ViewProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import type { SpacingToken } from '@bygsmart/tokens';

export interface StackProps extends ViewProps {
  gap?: SpacingToken;
  align?: 'stretch' | 'flex-start' | 'center' | 'flex-end';
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between';
  flex?: number;
}

function Flex({ direction, gap = 'md', align, justify, flex, style, ...props }: StackProps & { direction: 'row' | 'column' }) {
  const t = useTheme();
  return (
    <View
      style={[
        { flexDirection: direction, gap: t.spacing[gap], alignItems: align, justifyContent: justify, ...(flex != null && { flex }) },
        style,
      ]}
      {...props}
    />
  );
}

/** Vertical stack with token gap. */
export function VStack(props: StackProps) {
  return <Flex direction="column" {...props} />;
}

/** Horizontal stack with token gap. */
export function HStack(props: StackProps) {
  return <Flex direction="row" {...props} />;
}
