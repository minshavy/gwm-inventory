import { Input } from '@project/components/ui/input';
import { ComponentProps, useState } from 'react';

type Props = ComponentProps<typeof Input>;

export default function NumericInput({ value, onChange, onFocus, onBlur, ...props }: Props) {
  const [focused, setFocused] = useState(false);
  const isZero = String(value) === '0' || String(value) === '0.00' || String(value) === '0.0';

  return (
    <Input
      {...props}
      type="number"
      value={focused && isZero ? '' : value}
      onFocus={e => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={e => {
        setFocused(false);
        // If still empty after blur, restore 0
        if (e.target.value === '') {
          onChange?.({ ...e, target: { ...e.target, value: '0' } } as any);
        }
        onBlur?.(e);
      }}
      onChange={e => {
        onChange?.(e);
      }}
    />
  );
}
